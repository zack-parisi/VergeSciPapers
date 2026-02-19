import argparse
import os
import logging
from datetime import datetime, timedelta
from typing import List

from dotenv import load_dotenv

from .client import fetch_results
from .storage import upsert_documents
from .transform import work_to_doc
from .utils import filter_from_created
from .topics import NEUROSCIENCE_TOPICS

load_dotenv()

# Set up logging for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('from_created.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def is_neuroscience_related(work: dict, debug: bool = False) -> bool:
    """Check if a work is neuroscience-related based on OpenAlex fields."""
    
    # Extract all the neuroscience topic names from our list
    neuro_topic_names = [name for _, name in NEUROSCIENCE_TOPICS]
    
    # Also check for common neuroscience keywords as a fallback
    neuroscience_keywords = [
        "neuroscience", "neurology", "neural", "neuron", "brain", "cognitive",
        "psychology", "psychiatry", "neurodegenerative", "neuroplasticity",
        "neurotransmitter", "synapse", "cerebral", "cortical", "hippocampus",
        "alzheimer", "parkinson", "dementia", "epilepsy", "stroke", "tbi",
        "neuroimaging", "fmri", "eeg", "neuropsychology", "neurobiology"
    ]
    
    # Check primary_topic
    primary_topic = work.get("primary_topic")
    if primary_topic and primary_topic.get("display_name"):
        topic_name = primary_topic["display_name"].lower()
        # Check against our topic list
        if any(neuro_name.lower() in topic_name for neuro_name in neuro_topic_names):
            if debug:
                logger.debug(f"Match in primary_topic: {primary_topic['display_name']}")
            return True
        # Check against keywords
        if any(keyword in topic_name for keyword in neuroscience_keywords):
            if debug:
                logger.debug(f"Match in primary_topic (keyword): {primary_topic['display_name']}")
            return True
    
    # Check topics array
    topics = work.get("topics", [])
    for topic in topics:
        if topic and topic.get("display_name"):
            topic_name = topic.get("display_name", "").lower()
            if any(neuro_name.lower() in topic_name for neuro_name in neuro_topic_names):
                if debug:
                    logger.debug(f"Match in topics: {topic.get('display_name')}")
                return True
            if any(keyword in topic_name for keyword in neuroscience_keywords):
                if debug:
                    logger.debug(f"Match in topics (keyword): {topic.get('display_name')}")
                return True
    
    # Check concepts array (most reliable)
    concepts = work.get("concepts", [])
    for concept in concepts:
        if concept and concept.get("display_name"):
            concept_name = concept.get("display_name", "").lower()
            # Check against our topic list
            if any(neuro_name.lower() in concept_name for neuro_name in neuro_topic_names):
                if debug:
                    logger.debug(f"Match in concepts: {concept.get('display_name')}")
                return True
            # Check against keywords
            if any(keyword in concept_name for keyword in neuroscience_keywords):
                if debug:
                    logger.debug(f"Match in concepts (keyword): {concept.get('display_name')}")
                return True
    
    # Check title and abstract for neuroscience keywords
    title = (work.get("display_name") or "").lower()
    abstract = (work.get("abstract") or "").lower()
    combined_text = title + " " + abstract
    if any(keyword in combined_text for keyword in neuroscience_keywords):
        if debug:
            logger.debug(f"Match in title/abstract: {work.get('display_name', '')[:60]}")
        return True
    
    # Check keywords array
    keywords = work.get("keywords", [])
    for keyword in keywords:
        if keyword:
            if isinstance(keyword, dict):
                keyword_name = keyword.get("display_name", "").lower()
            else:
                keyword_name = str(keyword).lower()
            if any(neuro_name.lower() in keyword_name for neuro_name in neuro_topic_names):
                if debug:
                    logger.debug(f"Match in keywords: {keyword_name}")
                return True
            if any(keyword in keyword_name for keyword in neuroscience_keywords):
                if debug:
                    logger.debug(f"Match in keywords (keyword): {keyword_name}")
                return True
    
    # Check mesh terms
    mesh = work.get("mesh", [])
    for mesh_term in mesh:
        if mesh_term:
            if isinstance(mesh_term, dict):
                mesh_name = mesh_term.get("display_name", "").lower()
            else:
                mesh_name = str(mesh_term).lower()
            if any(neuro_name.lower() in mesh_name for neuro_name in neuro_topic_names):
                if debug:
                    logger.debug(f"Match in mesh: {mesh_name}")
                return True
            if any(keyword in mesh_name for keyword in neuroscience_keywords):
                if debug:
                    logger.debug(f"Match in mesh (keyword): {mesh_name}")
                return True
    
    return False


def main():
    parser = argparse.ArgumentParser(description="Fetch neuroscience works from OpenAlex from_created_date and store to MongoDB.")
    parser.add_argument("--from-date", type=str, help="Date to start from (YYYY-MM-DD). Defaults to yesterday for daily cron jobs.")
    parser.add_argument("--per-page", type=int, default=200)
    parser.add_argument("--max-pages", type=int, help="Max pages to fetch (no default = fetch all)")
    parser.add_argument("--collection", type=str, default="verge_neuro_lit_topics.from_created")
    parser.add_argument("--log-level", type=str, default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()

    # Set log level
    logger.setLevel(getattr(logging, args.log_level))

    # Calculate from_date automatically for daily cron jobs
    if args.from_date:
        from_date = args.from_date
    else:
        # Default to yesterday for daily 2am cron jobs
        yesterday = datetime.now() - timedelta(days=1)
        from_date = yesterday.strftime("%Y-%m-%d")

    try:
        logger.info(f"Starting from_created scraper - fetching papers created from {from_date}")
        logger.info(f"Looking for papers matching {len(NEUROSCIENCE_TOPICS)} neuroscience topics")
        
        base = filter_from_created(from_date)
        total_fetched = 0
        neuro_papers = 0

        for work in fetch_results(base, per_page=args.per_page, max_pages=args.max_pages):
            total_fetched += 1
            
            # Log progress every 100 papers
            if total_fetched % 100 == 0:
                logger.info(f"Processed {total_fetched} total papers, found {neuro_papers} neuroscience papers so far...")
            
            # Filter for neuroscience-related papers
            # Log sample papers every 1000 to debug filter
            if total_fetched % 1000 == 0 and total_fetched > 0:
                title = (work.get('display_name') or 'No title')[:80]
                primary_topic_obj = work.get('primary_topic')
                primary_topic = primary_topic_obj.get('display_name', 'None') if primary_topic_obj else 'None'
                concepts = [c.get('display_name', '') for c in work.get('concepts', [])[:3] if c]
                logger.info(f"Sample paper #{total_fetched}: '{title}' | Primary topic: {primary_topic} | Concepts: {concepts}")
            
            if is_neuroscience_related(work):
                doc = work_to_doc(work, filter_version="from_created_neuroscience")
                neuro_papers += 1
                # Fixed: Handle None values safely
                title = work.get('display_name') or 'No title'
                logger.info(f"Found neuroscience paper {neuro_papers}: {title[:60]}...")
                
                # Store immediately
                logger.info(f"Storing paper {neuro_papers} to database...")
                upsert_documents(args.collection, [doc])
        
        logger.info(f"Scraper completed successfully:")
        logger.info(f"  Date searched: {from_date}")
        logger.info(f"  Total papers fetched: {total_fetched}")
        logger.info(f"  Neuroscience papers found: {neuro_papers}")
        logger.info(f"  Neuroscience papers stored: {neuro_papers}")
        
    except Exception as e:
        logger.error(f"Scraper failed with error: {str(e)}")
        raise


if __name__ == "__main__":
    main()
