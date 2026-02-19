import argparse
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

from .client import fetch_results
from .storage import upsert_documents, get_mongo_client  # type: ignore
from .transform import work_to_doc
from .topics import NEUROSCIENCE_TOPICS

load_dotenv()

# Set up logging
logging.basicConfig(
	level=logging.INFO,
	format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


def _reconstruct_abstract(abstract_inverted_index: Dict) -> Optional[str]:
	if not abstract_inverted_index:
		return None
	words = {}
	max_pos = 0
	for word, positions in abstract_inverted_index.items():
		for pos in positions:
			words[pos] = word
			max_pos = max(max_pos, pos)
	if not words:
		return None
	return " ".join(words[i] for i in range(max_pos + 1) if i in words)


def _text_fields_for_match(work: Dict) -> List[str]:
	texts: List[str] = []
	title = work.get("display_name") or ""
	if isinstance(title, str):
		texts.append(title)
	abs_text = work.get("abstract") or None
	if not abs_text:
		abs_text = _reconstruct_abstract(work.get("abstract_inverted_index"))
	if abs_text:
		texts.append(abs_text)
	# Keywords
	for kw in work.get("keywords", []) or []:
		if isinstance(kw, dict):
			name = kw.get("display_name")
			if name:
				texts.append(name)
		elif isinstance(kw, str):
			texts.append(kw)
	# Mesh terms
	for m in work.get("mesh", []) or []:
		if isinstance(m, dict):
			name = m.get("display_name")
			if name:
				texts.append(name)
		elif isinstance(m, str):
			texts.append(m)
	# Concepts
	for c in work.get("concepts", []) or []:
		name = c.get("display_name") if isinstance(c, dict) else None
		if name:
			texts.append(name)
	# Topics and primary_topic
	pt = work.get("primary_topic") or {}
	if isinstance(pt, dict):
		name = pt.get("display_name")
		if name:
			texts.append(name)
	for t in work.get("topics", []) or []:
		name = t.get("display_name") if isinstance(t, dict) else None
		if name:
			texts.append(name)
	return texts


def matches_topic_anywhere(work: Dict, topic_name: str) -> bool:
	"""Return True if the provided topic name appears in any relevant field."""
	needle = topic_name.lower()
	for text in _text_fields_for_match(work):
		try:
			if needle in text.lower():
				return True
		except Exception:
			continue
	return False


def _get_checkpoint(coll, topic_key: str) -> Optional[str]:
	doc = coll.find_one({"_id": topic_key})
	if not doc:
		return None
	return doc.get("next_cursor")


def _save_checkpoint(coll, topic_key: str, next_cursor: Optional[str], completed: bool = False, processed: int = 0):
	update = {
		"$set": {
			"next_cursor": next_cursor,
			"completed": completed,
			"processed": processed,
		}
	}
	coll.update_one({"_id": topic_key}, update, upsert=True)


def crawl_one_topic(
	topic_name: str,
	collection_fqn: str,
	checkpoint_coll_fqn: str,
	per_page: int,
	max_pages_per_topic: Optional[int],
	resume: bool,
) -> Tuple[str, int]:
	"""Crawl one topic end-to-end, returning (topic_name, stored_count)."""
	client = get_mongo_client()
	try:
		db_name, coll_name = collection_fqn.split(".", 1)
		db = client[db_name]
		checkpoint_db_name, checkpoint_name = checkpoint_coll_fqn.split(".", 1)
		checkpoint_db = client[checkpoint_db_name]
		checkpoint_coll = checkpoint_db[checkpoint_name]

		stored = 0
		processed = 0

		# Use OpenAlex general search to get broad candidates quickly
		# We'll still validate with matches_topic_anywhere
		params: Dict[str, str] = {"search": topic_name}

		# Resume by cursor if available
		next_cursor = "*"
		if resume:
			cp = _get_checkpoint(checkpoint_coll, topic_name)
			if cp:
				next_cursor = cp
				logger.info(f"Resuming topic '{topic_name}' from cursor checkpoint")

		# Paginate
		page_count = 0
		docs_batch: List[Dict] = []

		while True:
			# Inject cursor into params each loop
			page_params = dict(params)
			page_params["cursor"] = next_cursor
			for work in fetch_results(page_params, per_page=per_page, max_pages=1):
				processed += 1
				if matches_topic_anywhere(work, topic_name):
					doc = work_to_doc(work, filter_version="general_topics_full")
					docs_batch.append(doc)
					if len(docs_batch) >= 500:
						upsert_documents(collection_fqn, docs_batch)
						stored += len(docs_batch)
						docs_batch = []

			# After iterating results for current cursor page, we need to fetch the next cursor.
			# The fetch_results generator abstracts pages; to capture next cursor, we re-call a single-page paginate.
			# Easiest approach: reuse client.paginate? Not exposed. As a workaround, call one-page again to retrieve meta via requests is not available here.
			# Instead, we will rely on max_pages=1 loops with next_cursor carried via client.paginate; since we don't have direct access,
			# we compute progress by saving a checkpoint every page based on a separate marker: processed count.
			# To still support resume properly, we will refresh next_cursor using a lightweight trick: call the works endpoint once with per-page=1 to read meta.
			from .client import _get, OPENALEX_BASE_URL  # type: ignore
			resp = _get(OPENALEX_BASE_URL, {**params, "per-page": str(per_page), "cursor": next_cursor})
			data = resp.json()
			next_cursor_value = data.get("meta", {}).get("next_cursor")

			# Save checkpoint
			_save_checkpoint(checkpoint_coll, topic_name, next_cursor_value, completed=False, processed=processed)

			page_count += 1
			if max_pages_per_topic and page_count >= max_pages_per_topic:
				break
			if not next_cursor_value:
				break
			next_cursor = next_cursor_value

		# Flush remaining batch
		if docs_batch:
			upsert_documents(collection_fqn, docs_batch)
			stored += len(docs_batch)

		# Mark completed
		_save_checkpoint(checkpoint_coll, topic_name, None, completed=True, processed=processed)
		logger.info(f"Topic '{topic_name}' finished. Stored: {stored}, Processed: {processed}")
		return topic_name, stored
	finally:
		client.close()


def main():
	parser = argparse.ArgumentParser(description="Parallel, resumable OpenAlex crawl across neuroscience topics.")
	parser.add_argument("--workers", type=int, default=6)
	parser.add_argument("--per-page", type=int, default=200)
	parser.add_argument("--max-pages-per-topic", type=int, default=0, help="0 = no limit")
	parser.add_argument("--collection", type=str, default="verge_neuro_lit_topics.papers_stagingV2")
	parser.add_argument("--checkpoint-coll", type=str, default="verge_neuro_lit_topics.crawl_checkpoints")
	parser.add_argument("--resume", action="store_true")
	args = parser.parse_args()

	topic_names = [name for _, name in NEUROSCIENCE_TOPICS]
	max_pages = args.max_pages_per_topic or None

	logger.info(f"Starting general crawl for {len(topic_names)} topics")
	logger.info(f"Target collection: {args.collection}")
	logger.info(f"Checkpoint collection: {args.checkpoint_coll}")
	logger.info(f"Workers: {args.workers}, per-page: {args.per_page}, max-pages-per-topic: {max_pages or '∞'}")

	results: List[Tuple[str, int]] = []
	with ThreadPoolExecutor(max_workers=args.workers) as executor:
		futures = [
			executor.submit(
				crawl_one_topic,
				topic_name,
				args.collection,
				args.checkpoint_coll,
				args.per_page,
				max_pages,
				args.resume,
			)
			for topic_name in topic_names
		]
		for f in as_completed(futures):
			try:
				res = f.result()
				results.append(res)
				logger.info(f"Completed topic: {res[0]} (stored {res[1]})")
			except Exception as e:
				logger.error(f"Topic crawl failed: {e}")

	total_stored = sum(x[1] for x in results)
	logger.info(f"Crawl complete. Total stored: {total_stored}")


if __name__ == "__main__":
	main() 