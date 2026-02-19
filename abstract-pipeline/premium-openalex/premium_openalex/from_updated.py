import argparse
import os
import logging
from typing import List

from dotenv import load_dotenv

from .client import fetch_results
from .storage import upsert_documents
from .transform import work_to_doc
from .utils import filter_from_updated
from .topics import NEUROSCIENCE_TOPICS

load_dotenv()

# Set up logging for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('from_updated.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def is_neuroscience_related(work: dict) -> bool:
    """Check if a work is neuroscience-related based on OpenAlex fields."""
    
    # Extract all the neuroscience topic names from our list
    neuro_topic_names = [name for _, name in NEUROSCIENCE_TOPICS]
    
    # Check primary_topic
    primary_topic = work.get("primary_topic")
    if primary_topic and primary_topic.get("display_name"):
        if any(neuro_name.lower() in primary_topic["display_name"].lower() for neuro_name in neuro_topic_names):
            return True
    
    # Check topics array
    topics = work.get("topics", [])
    for topic in topics:
        if topic and topic.get("display_name"):
            topic_name = topic.get("display_name", "")
            if any(neuro_name.lower() in topic_name.lower() for neuro_name in neuro_topic_names):
                return True
    
    # Check concepts array
    concepts = work.get("concepts", [])
    for concept in concepts:
        if concept and concept.get("display_name"):
            concept_name = concept.get("display_name", "")
            if any(neuro_name.lower() in concept_name.lower() for neuro_name in neuro_topic_names):
                return True
    
    # Check keywords array (keywords are dictionaries with 'display_name' field)
    keywords = work.get("keywords", [])
    for keyword in keywords:
        if keyword:
            if isinstance(keyword, dict):
                keyword_name = keyword.get("display_name", "")
            else:
                keyword_name = str(keyword)
            if any(neuro_name.lower() in keyword_name.lower() for neuro_name in neuro_topic_names):
                return True
    
    # Check mesh terms (mesh terms are also dictionaries with 'display_name' field)
    mesh = work.get("mesh", [])
    for mesh_term in mesh:
        if mesh_term:
            if isinstance(mesh_term, dict):
                mesh_name = mesh_term.get("display_name", "")
            else:
                mesh_name = str(mesh_term)
            if any(neuro_name.lower() in mesh_name.lower() for neuro_name in neuro_topic_names):
                return True
    
    return False


def main():
    parser = argparse.ArgumentParser(description="Fetch neuroscience works from OpenAlex from_updated_date and store to MongoDB.")
    parser.add_argument("--hours", type=int, default=24, help="Hours back from now to query from_updated_date (default: 24 for daily runs)")
    parser.add_argument("--per-page", type=int, default=200)
    parser.add_argument("--max-pages", type=int, help="Max pages to fetch (no default = fetch all)")
    parser.add_argument("--collection", type=str, default="verge_neuro_lit_topics.from_created")
    parser.add_argument("--log-level", type=str, default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()

    # Set log level
    logger.setLevel(getattr(logging, args.log_level))

    try:
        logger.info(f"Starting from_updated scraper - fetching papers updated in the last {args.hours} hours")
        logger.info(f"Looking for papers matching {len(NEUROSCIENCE_TOPICS)} neuroscience topics")
        
        base = filter_from_updated(args.hours)
        docs: List[dict] = []
        total_fetched = 0
        neuro_papers = 0

        for work in fetch_results(base, per_page=args.per_page, max_pages=args.max_pages):
            total_fetched += 1
            
            # Filter for neuroscience-related papers
            if is_neuroscience_related(work):
                doc = work_to_doc(work, filter_version="from_updated_neuroscience")
                docs.append(doc)
                neuro_papers += 1
                # Fixed: Handle None values safely
                title = work.get('display_name') or 'No title'
                logger.info(f"Found neuroscience paper {neuro_papers}: {title[:60]}...")
                
                if len(docs) >= 100:
                    logger.info(f"Storing {len(docs)} neuroscience papers...")
                    upsert_documents(args.collection, docs)
                    docs = []
        
        if docs:
            logger.info(f"Storing final {len(docs)} neuroscience papers...")
            upsert_documents(args.collection, docs)
        
        logger.info(f"Scraper completed successfully:")
        logger.info(f"  Hours searched: {args.hours}")
        logger.info(f"  Total papers fetched: {total_fetched}")
        logger.info(f"  Neuroscience papers found: {neuro_papers}")
        logger.info(f"  Neuroscience papers stored: {neuro_papers}")
        
    except Exception as e:
        logger.error(f"Scraper failed with error: {str(e)}")
        raise


if __name__ == "__main__":
    main()
