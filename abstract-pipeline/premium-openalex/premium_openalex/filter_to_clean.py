import os
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

from dotenv import load_dotenv
from pymongo import MongoClient
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
import certifi

load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('filter_to_clean.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_requested
    logger.warning(f"Received signal {signum}. Initiating graceful shutdown...")
    shutdown_requested = True

# Set up signal handlers for graceful shutdown
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# Initialize OpenAI client for embeddings (lazy loaded)
_openai_client = None

def get_openai_client():
    """Get or create OpenAI client"""
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            _openai_client = OpenAI(api_key=api_key)
            logger.info("OpenAI client initialized for embeddings")
        else:
            logger.warning("OPENAI_API_KEY not found - embeddings will be skipped")
    return _openai_client


def prepare_text_for_embedding(paper: Dict) -> str:
    """
    Prepare comprehensive text from paper data for embedding.
    Same logic as vectorization script.
    """
    text_parts = []
    
    # Title (most important)
    if paper.get('title'):
        text_parts.append(f"Title: {paper['title']}")
    
    # Abstract (very important for semantic understanding)
    if paper.get('abstract'):
        text_parts.append(f"Abstract: {paper['abstract']}")
    
    # Authors
    if paper.get('authors_string'):
        text_parts.append(f"Authors: {paper['authors_string']}")
    elif paper.get('authors') and isinstance(paper['authors'], list):
        authors = ', '.join([a if isinstance(a, str) else str(a) for a in paper['authors']])
        if authors:
            text_parts.append(f"Authors: {authors}")
    
    # Journal
    if paper.get('journal'):
        text_parts.append(f"Journal: {paper['journal']}")
    
    # Keywords
    if paper.get('keywords') and isinstance(paper['keywords'], list):
        keywords = ', '.join([str(k) for k in paper['keywords']])
        if keywords:
            text_parts.append(f"Keywords: {keywords}")
    
    # Subfields
    if paper.get('subfields') and isinstance(paper['subfields'], list):
        subfields = ', '.join([str(s) for s in paper['subfields']])
        if subfields:
            text_parts.append(f"Subfields: {subfields}")
    
    # MeSH terms (medical subject headings - important for biomedical papers)
    if paper.get('mesh_terms') and isinstance(paper['mesh_terms'], list):
        mesh = ', '.join([str(m) for m in paper['mesh_terms'][:10]])  # Limit to first 10
        if mesh:
            text_parts.append(f"MeSH Terms: {mesh}")
    
    # Combine all parts
    full_text = ' | '.join(text_parts)
    
    # Truncate if too long (OpenAI has token limits)
    # text-embedding-3-small supports up to 8191 tokens
    # Roughly 4 characters per token, so limit to ~24000 characters to be safer
    if len(full_text) > 24000:
        full_text = full_text[:24000] + "..."
    
    return full_text


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30)
)
def get_embedding(text: str, model: str = 'text-embedding-3-small') -> List[float]:
    """
    Get embedding from OpenAI API with retry logic.
    """
    client = get_openai_client()
    if not client:
        return None
    
    try:
        response = client.embeddings.create(
            input=text,
            model=model
        )
        return response.data[0].embedding
    except Exception as e:
        logger.warning(f"Error getting embedding: {str(e)}")
        raise


def add_vector_to_paper(paper: Dict) -> bool:
    """
    Add vector embedding to a paper.
    Returns True if successful, False otherwise.
    """
    try:
        text = prepare_text_for_embedding(paper)
        
        if not text.strip():
            logger.warning(f"Empty text for paper {paper.get('_id', 'unknown')}, skipping embedding")
            return False
        
        vector = get_embedding(text)
        
        if vector:
            paper['vector'] = vector
            paper['vectorized_at'] = datetime.now(timezone.utc)
            paper['vector_model'] = 'text-embedding-3-small'
            paper['vector_dimensions'] = len(vector)
            return True
        else:
            logger.warning(f"Failed to get embedding for paper {paper.get('_id', 'unknown')}")
            return False
            
    except Exception as e:
        logger.warning(f"Error adding vector to paper {paper.get('_id', 'unknown')}: {str(e)}")
        return False


def embed_new_papers(papers: List[Dict], collection_name: str) -> int:
    """
    Add embeddings to NEW papers (not updates).
    Returns count of successfully embedded papers.
    """
    if not papers:
        return 0
    
    client = get_openai_client()
    if not client:
        logger.info("OpenAI API key not configured - skipping embeddings")
        return 0
    
    embedded_count = 0
    failed_count = 0
    
    logger.info(f"Adding embeddings to {len(papers)} new papers from {collection_name}...")
    
    for paper in papers:
        try:
            if add_vector_to_paper(paper):
                embedded_count += 1
            else:
                failed_count += 1
            
            # Small delay to respect rate limits (1M tokens per minute)
            time.sleep(0.1)
            
        except Exception as e:
            logger.warning(f"Failed to embed paper {paper.get('_id', 'unknown')}: {str(e)}")
            failed_count += 1
    
    logger.info(f"Embedding complete: {embedded_count} successful, {failed_count} failed")
    return embedded_count



def get_mongo_client() -> MongoClient:
    """Get MongoDB client connection"""
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    return MongoClient(uri, tlsCAFile=certifi.where())


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


def calculate_global_stats(collection):
    """Calculate global statistics needed for normalization - optimized for large collections"""
    logger.info("Calculating global statistics for relevance scoring...")
    
    # Quick check using estimated count
    try:
        doc_count = collection.estimated_document_count()
    except:
        doc_count = 0
    
    if doc_count == 0:
        logger.info("papers_clean collection is empty or doesn't exist. Using default stats.")
        return {"max_citations": 1, "max_days_since_pub": 365 * 10}  # Default to 10 years
    
    # For large collections, use optimized queries with limits
    try:
        # Get max citations using a simple sort and limit
        max_citation_doc = collection.find_one(
            {"cited_by_count": {"$exists": True}},
            sort=[("cited_by_count", -1)],
            projection={"cited_by_count": 1}
        )
        max_citations = max_citation_doc.get("cited_by_count", 1) if max_citation_doc else 1
        
        # Get oldest publication date using a simple sort and limit
        oldest_doc = collection.find_one(
            {"publication_date": {"$exists": True, "$ne": None}},
            sort=[("publication_date", 1)],
            projection={"publication_date": 1}
        )
        
        if oldest_doc and oldest_doc.get("publication_date"):
            try:
                oldest_date = datetime.strptime(oldest_doc["publication_date"], "%Y-%m-%d")
                if oldest_date.tzinfo is None:
                    oldest_date = oldest_date.replace(tzinfo=timezone.utc)
                max_days_since_pub = max(1, (datetime.now(timezone.utc) - oldest_date).days)
            except (ValueError, TypeError):
                max_days_since_pub = 365 * 10
        else:
            max_days_since_pub = 365 * 10
        
        global_stats = {
            "max_citations": max_citations,
            "max_days_since_pub": max_days_since_pub
        }
        
        logger.info(f"Global stats - Max citations: {max_citations}, Max days since pub: {max_days_since_pub}")
        return global_stats
        
    except Exception as e:
        logger.warning(f"Error calculating stats: {e}. Using defaults.")
        return {"max_citations": 1, "max_days_since_pub": 365 * 10}


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
            # Make pub_date timezone-aware for comparison
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)
            days_since_pub = (datetime.now(timezone.utc) - pub_date).days
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
    
    return max(0, min(1, relevance_score))  # Ensure score is between 0 and 1


def is_paper_clean(paper: Dict) -> bool:
    """Check if a paper has all required fields populated and is in English"""
    required_fields = [
        'title',
        'abstract', 
        'publication_date',
        'doi',
        'authors'
    ]
    
    for field in required_fields:
        value = paper.get(field)
        
        # Check for None, empty string, or empty list
        if value is None:
            logger.debug(f"Paper {paper.get('_id', 'unknown')} has None value for field: {field}")
            return False
        
        if isinstance(value, str) and value.strip() == '':
            logger.debug(f"Paper {paper.get('_id', 'unknown')} has empty string for field: {field}")
            return False
        
        if isinstance(value, list) and len(value) == 0:
            logger.debug(f"Paper {paper.get('_id', 'unknown')} has empty list for field: {field}")
            return False
    
    # Check for English language only
    language = paper.get('language')
    if language != 'en':
        logger.debug(f"Paper {paper.get('_id', 'unknown')} has non-English language: {language}")
        return False
    
    return True


def add_journal_if_not_exists(journals_collection, journal_name: str) -> bool:
    """
    Check if a journal exists in the journals collection and add it if not found.
    Returns True if journal was added, False if it already existed.
    """
    if not journal_name or not isinstance(journal_name, str) or journal_name.strip() == '':
        logger.debug("Skipping journal addition - invalid or empty journal name")
        return False
    
    journal_name = journal_name.strip()
    
    try:
        # Check if journal already exists (case-insensitive to avoid duplicates)
        existing_journal = journals_collection.find_one({
            'name': {'$regex': f'^{journal_name}$', '$options': 'i'}
        })
        
        if existing_journal:
            logger.debug(f"Journal already exists: {journal_name}")
            return False
        
        # Add the journal with timestamp
        journal_doc = {
            'name': journal_name,
            'added_at': datetime.now(timezone.utc),
            'paper_count': 1  # Initialize with 1 paper
        }
        journals_collection.insert_one(journal_doc)
        logger.info(f"Added new journal to collection: {journal_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to add journal '{journal_name}': {str(e)}")
        return False


def process_collection_to_clean(source_collection, target_collection, journals_collection, global_stats, 
                                collection_name: str, timeout_seconds: Optional[int] = None, 
                                start_time: Optional[datetime] = None):
    """Process papers from source collection to clean collection - continues until empty"""
    logger.info(f"Processing {collection_name} collection...")
    
    total_moved = 0
    total_upserted = 0
    total_processed = 0
    total_skipped = 0
    total_journals_added = 0
    batch_count = 0
    max_batches = 10000  # Safety limit to prevent infinite loops
    consecutive_zero_removals = 0  # Track consecutive batches with no removals
    max_consecutive_zero_removals = 10  # Stop if we can't remove papers for 10 consecutive batches
    seen_paper_ids = set()  # Track papers we've seen to detect stuck papers
    
    while True:
        # Check for shutdown signal
        if shutdown_requested:
            logger.warning(f"Shutdown requested. Stopping processing of {collection_name} collection.")
            break
        
        # Check timeout periodically (if configured)
        if timeout_seconds and start_time:
            elapsed_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            if elapsed_time > timeout_seconds:
                logger.warning(f"Timeout reached ({elapsed_time:.1f}s > {timeout_seconds}s) while processing {collection_name}.")
                logger.warning(f"Processed {total_processed} papers so far. Will stop after current batch.")
                break
            
        # Safety check: prevent infinite loops
        if batch_count >= max_batches:
            logger.error(f"Reached maximum batch limit ({max_batches}) for {collection_name}. Stopping to prevent infinite loop.")
            break
            
        # Check if collection is empty
        remaining_papers = source_collection.count_documents({})
        if remaining_papers == 0:
            logger.info(f"{collection_name} collection is now empty - processing complete!")
            break
            
        batch_count += 1
        logger.info(f"Processing batch {batch_count} of {collection_name} - {remaining_papers} papers remaining")
        
        # Process papers in batches
        batch_size = 100
        papers = list(source_collection.find({}).limit(batch_size))
        
        if not papers:
            logger.info(f"No more papers found in {collection_name}")
            break
        
        # Detect stuck papers (papers that keep appearing in batches)
        current_batch_ids = {paper['_id'] for paper in papers}
        stuck_papers = current_batch_ids & seen_paper_ids
        
        if stuck_papers:
            logger.warning(f"Detected {len(stuck_papers)} stuck papers that have appeared in previous batches")
            logger.warning(f"Forcefully removing stuck papers to prevent infinite loop: {list(stuck_papers)[:5]}...")
            
            # Force remove stuck papers
            try:
                result = source_collection.delete_many({'_id': {'$in': list(stuck_papers)}})
                total_skipped += result.deleted_count
                logger.info(f"Force-removed {result.deleted_count} stuck papers from {collection_name}")
            except Exception as e:
                logger.error(f"Failed to force-remove stuck papers: {str(e)}")
            
            # Refresh the batch after removing stuck papers
            papers = list(source_collection.find({}).limit(batch_size))
            if not papers:
                logger.info(f"No more papers found in {collection_name} after removing stuck papers")
                break
        
        # Update seen papers
        seen_paper_ids.update(current_batch_ids)
            
        clean_papers = []
        papers_to_remove = []
        
        for paper in papers:
            total_processed += 1
            
            # Save the original _id before any modifications
            original_id = paper['_id']
            
            if not is_paper_clean(paper):
                # Fixed: Handle None title safely
                title = paper.get('title') or 'No title'
                logger.debug(f"Skipping unclean paper: {title[:50]}...")
                papers_to_remove.append(original_id)
                continue
            
            # Calculate relevance score
            relevance_score = calculate_advanced_relevance(paper, global_stats)
            paper['relevance_score'] = relevance_score
            paper['processed_at'] = datetime.now(timezone.utc)
            paper['source_collection'] = collection_name
            
            # Add authors_string for fast searching (concatenate array into single string)
            if paper.get('authors') and isinstance(paper['authors'], list):
                paper['authors_string'] = ' | '.join(paper['authors'])
            else:
                paper['authors_string'] = ''
            
            # Check and add journal to journals collection if not exists
            journal_name = paper.get('journal')
            if journal_name:
                if add_journal_if_not_exists(journals_collection, journal_name):
                    total_journals_added += 1
            
            # Check if paper already exists in papers_clean by DOI
            doi = paper.get('doi')
            if doi:
                existing_paper = target_collection.find_one({'doi': doi})
                if existing_paper:
                    # Update existing paper
                    paper['_id'] = existing_paper['_id']  # Keep original ID
                    target_collection.replace_one({'_id': existing_paper['_id']}, paper)
                    total_upserted += 1
                    # Fixed: Handle None title safely
                    title = paper.get('title') or 'No title'
                    logger.info(f"Updated existing paper: {title[:50]}... (DOI: {doi})")
                else:
                    # New paper
                    clean_papers.append(paper)
                    total_moved += 1
            else:
                # No DOI, treat as new paper
                clean_papers.append(paper)
                total_moved += 1
            
            # Use the original _id for removal from source collection
            papers_to_remove.append(original_id)
        
        # Insert new clean papers (with embeddings)
        if clean_papers:
            try:
                # Add embeddings to NEW papers before inserting
                embedded_count = embed_new_papers(clean_papers, collection_name)
                logger.info(f"Batch {batch_count}: Added embeddings to {embedded_count}/{len(clean_papers)} papers")
                
                # Insert papers into papers_clean (with or without embeddings)
                target_collection.insert_many(clean_papers)
                logger.info(f"Batch {batch_count}: Inserted {len(clean_papers)} new papers to papers_clean")
            except Exception as e:
                logger.error(f"Failed to insert clean papers: {str(e)}")
        
        # Remove processed papers from source collection
        removed_count = 0
        if papers_to_remove:
            try:
                # Log the IDs we're trying to remove for debugging
                logger.debug(f"Attempting to remove {len(papers_to_remove)} papers with IDs: {papers_to_remove[:5]}...")
                
                result = source_collection.delete_many({'_id': {'$in': papers_to_remove}})
                removed_count = result.deleted_count
                
                if removed_count == 0:
                    consecutive_zero_removals += 1
                    logger.warning(f"Batch {batch_count}: Failed to remove any papers from {collection_name} (attempt {consecutive_zero_removals}/{max_consecutive_zero_removals})")
                    
                    # Check if papers still exist in the collection
                    still_existing = source_collection.count_documents({'_id': {'$in': papers_to_remove[:5]}})
                    logger.warning(f"Papers still exist in collection: {still_existing} out of 5 checked")
                    
                    if consecutive_zero_removals >= max_consecutive_zero_removals:
                        logger.error(f"Failed to remove papers for {consecutive_zero_removals} consecutive batches. Stopping to prevent infinite loop.")
                        break
                else:
                    consecutive_zero_removals = 0  # Reset counter on successful removal
                    
                logger.info(f"Batch {batch_count}: Removed {removed_count} papers from {collection_name}")
                
            except Exception as e:
                logger.error(f"Failed to remove papers from {collection_name}: {str(e)}")
                consecutive_zero_removals += 1
                if consecutive_zero_removals >= max_consecutive_zero_removals:
                    logger.error(f"Failed to remove papers for {consecutive_zero_removals} consecutive batches. Stopping to prevent infinite loop.")
                    break
        else:
            logger.warning(f"Batch {batch_count}: No papers to remove from {collection_name}")
            consecutive_zero_removals += 1
            if consecutive_zero_removals >= max_consecutive_zero_removals:
                logger.error(f"No papers to remove for {consecutive_zero_removals} consecutive batches. Stopping to prevent infinite loop.")
                break
        
        logger.info(f"Batch {batch_count} complete: {len(papers)} papers processed")
    
    logger.info(f"{collection_name} processing complete:")
    logger.info(f"  Total processed: {total_processed}")
    logger.info(f"  New papers moved: {total_moved}")
    logger.info(f"  Existing papers updated: {total_upserted}")
    logger.info(f"  Stuck papers skipped: {total_skipped}")
    logger.info(f"  New journals added: {total_journals_added}")
    logger.info(f"  Batches processed: {batch_count}")
    
    return total_moved, total_upserted, total_skipped, total_journals_added


def main():
    """Main function to process papers from staging collections to clean collection"""
    logger.info("Starting filter_to_clean process...")
    
    # Set up timeout - default to 8 hours (28800 seconds) to allow both collections to complete
    # Can be disabled by setting to 0 or a very large value
    timeout_seconds = int(os.getenv("FILTER_TIMEOUT_SECONDS", "28800"))
    start_time = datetime.now(timezone.utc)
    
    if timeout_seconds > 0:
        logger.info(f"Process timeout set to {timeout_seconds} seconds ({timeout_seconds/3600:.1f} hours)")
    else:
        logger.info("Process timeout disabled - will run until all collections are processed")
        timeout_seconds = None
    
    client = None
    try:
        client = get_mongo_client()
        db = client['verge_neuro_lit_topics']
        
        # Get collections
        from_updated_collection = db['from_updated']
        from_created_collection = db['from_created']
        papers_clean_collection = db['papers_clean']
        journals_collection = db['journals']
        
        # Log initial collection sizes
        initial_updated_count = from_updated_collection.count_documents({})
        initial_created_count = from_created_collection.count_documents({})
        initial_clean_count = papers_clean_collection.count_documents({})
        
        logger.info("Initial collection sizes:")
        logger.info(f"  from_updated: {initial_updated_count} papers")
        logger.info(f"  from_created: {initial_created_count} papers")
        logger.info(f"  papers_clean: {initial_clean_count} papers")
        
        # Calculate global stats from papers_clean (for relevance scoring)
        # This will handle empty/non-existent collection gracefully
        logger.info("Calculating global statistics for relevance scoring...")
        global_stats = calculate_global_stats(papers_clean_collection)
        
        # Process from_updated collection until empty
        logger.info("=" * 50)
        logger.info("Processing from_updated collection...")
        logger.info("=" * 50)
        moved_updated, upserted_updated, skipped_updated, journals_added_updated = process_collection_to_clean(
            from_updated_collection, 
            papers_clean_collection,
            journals_collection,
            global_stats,
            'from_updated',
            timeout_seconds=timeout_seconds,
            start_time=start_time
        )
        
        # Check shutdown signal between collections
        if shutdown_requested:
            logger.warning("Shutdown requested between collections. Stopping.")
            return
        
        # Log progress between collections
        elapsed_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"Elapsed time after from_updated: {elapsed_time:.1f}s ({elapsed_time/60:.1f} minutes)")
        
        # Process from_created collection until empty (or timeout)
        logger.info("=" * 50)
        logger.info("Processing from_created collection...")
        logger.info("=" * 50)
        moved_created, upserted_created, skipped_created, journals_added_created = process_collection_to_clean(
            from_created_collection, 
            papers_clean_collection,
            journals_collection,
            global_stats,
            'from_created',
            timeout_seconds=timeout_seconds,
            start_time=start_time
        )
        
        # Final summary
        total_moved = moved_updated + moved_created
        total_upserted = upserted_updated + upserted_created
        total_skipped = skipped_updated + skipped_created
        total_journals_added = journals_added_updated + journals_added_created
        
        logger.info("=" * 50)
        logger.info("Filter to clean process completed successfully:")
        logger.info(f"  New papers moved to papers_clean: {total_moved}")
        logger.info(f"  Existing papers updated in papers_clean: {total_upserted}")
        logger.info(f"  Stuck papers skipped: {total_skipped}")
        logger.info(f"  New journals added to journals collection: {total_journals_added}")
        logger.info(f"  Total papers processed: {total_moved + total_upserted + total_skipped}")
        logger.info("=" * 50)
        
        # Check final collection sizes
        final_updated_count = from_updated_collection.count_documents({})
        final_created_count = from_created_collection.count_documents({})
        final_clean_count = papers_clean_collection.count_documents({})
        
        # Calculate total processing time
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        logger.info("Final collection sizes:")
        logger.info(f"  from_updated: {final_updated_count} papers (started with {initial_updated_count})")
        logger.info(f"  from_created: {final_created_count} papers (started with {initial_created_count})")
        logger.info(f"  papers_clean: {final_clean_count} papers (started with {initial_clean_count})")
        logger.info(f"  Total processing time: {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
        
        # Verify that source collections are empty
        if final_updated_count > 0 or final_created_count > 0:
            logger.warning(f"WARNING: Source collections are not empty! from_updated: {final_updated_count}, from_created: {final_created_count}")
            logger.warning("This may indicate an issue with the filtering process.")
        else:
            logger.info("SUCCESS: All source collections are now empty!")
        
    except Exception as e:
        logger.error(f"Filter to clean process failed: {str(e)}")
        logger.error("This may indicate a database connection issue or data corruption.")
        raise
    finally:
        if client:
            client.close()
            logger.info("Database connection closed.")


if __name__ == "__main__":
    main()
