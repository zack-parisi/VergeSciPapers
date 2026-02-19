import argparse
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

import pymongo
from dotenv import load_dotenv

from .storage import get_mongo_client

load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


def load_ranking_config():
    """Load ranking algorithm configuration from config.json"""
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
            ranking_config = config.get("ranking_algorithm", {"alpha": 0.4, "beta": 0.6})
            return ranking_config.get("alpha", 0.4), ranking_config.get("beta", 0.6)
    except FileNotFoundError:
        logger.warning("config.json not found. Using default ranking parameters.")
        return 0.4, 0.6


def calculate_global_stats_from_staging(staging_collection):
    """Calculate global statistics from stagingV2 collection for better normalization"""
    logger.info("Calculating global statistics from stagingV2 for relevance scoring...")
    
    # Get max citations and oldest publication date from stagingV2
    pipeline = [
        {
            "$group": {
                "_id": None,
                "max_citations": {"$max": "$cited_by_count"},
                "min_pub_date": {"$min": {"$dateFromString": {"dateString": "$publication_date"}}}
            }
        }
    ]
    
    result = list(staging_collection.aggregate(pipeline))
    if not result:
        logger.warning("No data in stagingV2. Using default stats.")
        return {"max_citations": 1, "max_days_since_pub": 365 * 10}
    
    stats = result[0]
    max_citations = stats.get("max_citations", 1)
    oldest_date = stats.get("min_pub_date")
    
    # Calculate max days since publication
    if oldest_date:
        max_days_since_pub = max(1, (datetime.utcnow() - oldest_date).days)
    else:
        max_days_since_pub = 365 * 10  # Default to 10 years
    
    global_stats = {
        "max_citations": max_citations,
        "max_days_since_pub": max_days_since_pub
    }
    
    logger.info(f"Global stats from stagingV2 - Max citations: {max_citations}, Max days since pub: {max_days_since_pub}")
    return global_stats


def calculate_advanced_relevance(paper, global_stats):
    """
    Calculate relevance score using the advanced ranking algorithm:
    relevance_score = (1 - alpha * Rnorm) + (beta * Cnorm)
    
    Where:
    - Rnorm = days since published / max days since publication in dataset
    - Cnorm = citations / max citations in dataset
    - alpha + beta = 1
    """
    alpha, beta = load_ranking_config()
    
    # Get paper data
    citations = paper.get('cited_by_count', 0)
    publication_date = paper.get('publication_date')
    
    # Calculate recency normalization (Rnorm)
    try:
        if publication_date and global_stats['max_days_since_pub'] > 0:
            pub_date = datetime.strptime(publication_date, "%Y-%m-%d")
            days_since_pub = (datetime.utcnow() - pub_date).days
            Rnorm = max(0, days_since_pub / global_stats['max_days_since_pub'])
        else:
            Rnorm = 0
    except (ValueError, TypeError):
        Rnorm = 0
    
    # Calculate citation normalization (Cnorm)
    if global_stats['max_citations'] > 0:
        Cnorm = citations / global_stats['max_citations']
    else:
        Cnorm = 0
    
    # Calculate final relevance score
    relevance_score = (1 - alpha * Rnorm) + (beta * Cnorm)
    
    return max(0.0, min(1.0, relevance_score))  # Clamp between 0 and 1


def validate_paper(paper: Dict) -> bool:
    """
    Validate that a paper has all required fields populated.
    Returns True if paper is valid, False otherwise.
    """
    required_fields = [
        'doi', 'title', 'abstract', 'work_id', 'authors', 'subfields'
    ]
    
    for field in required_fields:
        value = paper.get(field)
        
        # Check if field is missing, None, or empty
        if value is None:
            return False
        
        # For lists, check if empty
        if isinstance(value, list) and len(value) == 0:
            return False
        
        # For strings, check if empty or just whitespace
        if isinstance(value, str) and not value.strip():
            return False
    
    return True


def process_stagingV2_to_clean(
    source_collection: str,
    target_collection: str,
    batch_size: int = 1000
) -> Dict[str, int]:
    """
    Process papers from stagingV2 to papers_clean with validation and relevance scoring.
    Returns statistics about the processing.
    """
    client = get_mongo_client()
    
    try:
        # Parse collection names
        source_db_name, source_coll_name = source_collection.split(".", 1)
        target_db_name, target_coll_name = target_collection.split(".", 1)
        
        source_db = client[source_db_name]
        target_db = client[target_db_name]
        source_coll = source_db[source_coll_name]
        target_coll = target_db[target_coll_name]
        
        # Ensure unique index on DOI for papers_clean
        target_coll.create_index([("doi", pymongo.ASCENDING)], unique=True, sparse=True)
        
        # Calculate global stats from stagingV2 (not from empty papers_clean)
        global_stats = calculate_global_stats_from_staging(source_coll)
        
        total_processed = 0
        total_valid = 0
        total_invalid = 0
        total_inserted = 0
        total_updated = 0
        
        logger.info(f"Starting processing from {source_collection} to {target_collection}")
        logger.info(f"Batch size: {batch_size}")
        
        # Process in batches
        while True:
            # Get batch of papers from stagingV2
            batch = list(source_coll.find().limit(batch_size))
            if not batch:
                break
            
            logger.info(f"Processing batch of {len(batch)} papers...")
            
            valid_papers = []
            invalid_paper_ids = []
            
            # Validate papers in batch
            for paper in batch:
                total_processed += 1
                
                if validate_paper(paper):
                    # Calculate relevance score
                    relevance_score = calculate_advanced_relevance(paper, global_stats)
                    paper['relevance_score'] = relevance_score
                    paper['filter_version'] = 'stagingV2_to_clean_v1.1_fixed'
                    paper['created_at'] = datetime.utcnow()
                    paper['updated_at'] = datetime.utcnow()
                    
                    valid_papers.append(paper)
                    total_valid += 1
                else:
                    invalid_paper_ids.append(paper['_id'])
                    total_invalid += 1
            
            # Upsert valid papers to papers_clean and track actual insertions vs updates
            batch_inserted = 0
            batch_updated = 0
            if valid_papers:
                for paper in valid_papers:
                    try:
                        # Check if paper already exists
                        existing = target_coll.find_one({"doi": paper["doi"]})
                        
                        # Use ReplaceOne with upsert=True for idempotency
                        result = target_coll.replace_one(
                            {"doi": paper["doi"]},
                            paper,
                            upsert=True
                        )
                        
                        if result.upserted_id:
                            # New document inserted
                            batch_inserted += 1
                            total_inserted += 1
                        elif result.modified_count > 0:
                            # Existing document updated
                            batch_updated += 1
                            total_updated += 1
                        # If modified_count is 0, document was identical (no change)
                        
                    except Exception as e:
                        logger.error(f"Error upserting paper {paper.get('doi', 'unknown')}: {e}")
            
            # Remove processed papers from stagingV2
            if batch:
                paper_ids = [paper['_id'] for paper in batch]
                delete_result = source_coll.delete_many({"_id": {"$in": paper_ids}})
                logger.info(f"Batch complete: {len(batch)} processed, {len(valid_papers)} valid, {batch_inserted} NEW INSERTED, {batch_updated} UPDATED, {delete_result.deleted_count} removed from stagingV2")
            
            # Update global stats periodically (every 10 batches)
            if total_processed % (batch_size * 10) == 0:
                global_stats = calculate_global_stats_from_staging(source_coll)
                logger.info(f"Updated global stats - processed {total_processed} papers so far")
        
        stats = {
            "total_processed": total_processed,
            "total_valid": total_valid,
            "total_invalid": total_invalid,
            "total_inserted": total_inserted,
            "total_updated": total_updated
        }
        
        logger.info("Processing completed successfully:")
        logger.info(f"  Total processed: {total_processed}")
        logger.info(f"  Valid papers: {total_valid}")
        logger.info(f"  Invalid papers: {total_invalid}")
        logger.info(f"  NEW papers inserted to papers_clean: {total_inserted}")
        logger.info(f"  Existing papers updated in papers_clean: {total_updated}")
        
        return stats
        
    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        raise
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description="Filter papers from stagingV2 to papers_clean with validation and relevance scoring.")
    parser.add_argument("--source", type=str, default="verge_neuro_lit_topics.papers_stagingV2", 
                       help="Source collection (default: verge_neuro_lit_topics.papers_stagingV2)")
    parser.add_argument("--target", type=str, default="verge_neuro_lit_topics.papers_clean",
                       help="Target collection (default: verge_neuro_lit_topics.papers_clean)")
    parser.add_argument("--batch-size", type=int, default=1000,
                       help="Batch size for processing (default: 1000)")
    
    args = parser.parse_args()
    
    logger.info("Starting stagingV2 to papers_clean filter process...")
    logger.info(f"Source: {args.source}")
    logger.info(f"Target: {args.target}")
    logger.info(f"Batch size: {args.batch_size}")
    
    try:
        stats = process_stagingV2_to_clean(args.source, args.target, args.batch_size)
        logger.info("Filter process completed successfully!")
        logger.info(f"Final statistics: {stats}")
        
    except Exception as e:
        logger.error(f"Filter process failed: {e}", exc_info=True)
        exit(1)


if __name__ == "__main__":
    main()
