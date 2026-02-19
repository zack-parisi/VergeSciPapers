import os
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Dict, List

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
        logging.FileHandler('process_staging_to_clean.log'),
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
    """Prepare comprehensive text from paper data for embedding."""
    text_parts = []
    
    if paper.get('title'):
        text_parts.append(f"Title: {paper['title']}")
    
    if paper.get('abstract'):
        text_parts.append(f"Abstract: {paper['abstract']}")
    
    if paper.get('authors_string'):
        text_parts.append(f"Authors: {paper['authors_string']}")
    elif paper.get('authors') and isinstance(paper['authors'], list):
        authors = ', '.join([a if isinstance(a, str) else str(a) for a in paper['authors']])
        if authors:
            text_parts.append(f"Authors: {authors}")
    
    if paper.get('journal'):
        text_parts.append(f"Journal: {paper['journal']}")
    
    if paper.get('keywords') and isinstance(paper['keywords'], list):
        keywords = ', '.join([str(k) for k in paper['keywords']])
        if keywords:
            text_parts.append(f"Keywords: {keywords}")
    
    if paper.get('subfields') and isinstance(paper['subfields'], list):
        subfields = ', '.join([str(s) for s in paper['subfields']])
        if subfields:
            text_parts.append(f"Subfields: {subfields}")
    
    if paper.get('mesh_terms') and isinstance(paper['mesh_terms'], list):
        mesh = ', '.join([str(m) for m in paper['mesh_terms'][:10]])
        if mesh:
            text_parts.append(f"MeSH Terms: {mesh}")
    
    full_text = ' | '.join(text_parts)
    
    if len(full_text) > 24000:
        full_text = full_text[:24000] + "..."
    
    return full_text


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30)
)
def get_batch_embeddings(texts: List[str], model: str = 'text-embedding-3-small') -> List[List[float]]:
    """Get embeddings for multiple texts in one API call (OPTIMIZED)."""
    client = get_openai_client()
    if not client:
        return None
    
    try:
        response = client.embeddings.create(
            input=texts,
            model=model
        )
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]
    except Exception as e:
        logger.warning(f"Error getting batch embeddings: {str(e)}")
        raise


def embed_new_papers(papers: List[Dict], collection_name: str) -> int:
    """Add embeddings to NEW papers - OPTIMIZED with batch processing."""
    if not papers:
        return 0
    
    client = get_openai_client()
    if not client:
        logger.info("OpenAI API key not configured - skipping embeddings")
        return 0
    
    embedded_count = 0
    failed_count = 0
    
    logger.info(f"Adding embeddings to {len(papers)} new papers (BATCH MODE)...")
    
    paper_text_pairs = []
    for paper in papers:
        text = prepare_text_for_embedding(paper)
        if text.strip():
            paper_text_pairs.append((paper, text))
        else:
            logger.warning(f"Empty text for paper {paper.get('_id', 'unknown')}, skipping")
            failed_count += 1
    
    if not paper_text_pairs:
        logger.info("No papers with valid text to embed")
        return 0
    
    BATCH_SIZE = 40
    for i in range(0, len(paper_text_pairs), BATCH_SIZE):
        batch = paper_text_pairs[i:i + BATCH_SIZE]
        batch_papers = [p for p, _ in batch]
        batch_texts = [t for _, t in batch]
        
        try:
            embeddings = get_batch_embeddings(batch_texts)
            
            if embeddings:
                for paper, embedding in zip(batch_papers, embeddings):
                    paper['vector'] = embedding
                    paper['vectorized_at'] = datetime.now(timezone.utc)
                    paper['vector_model'] = 'text-embedding-3-small'
                    paper['vector_dimensions'] = len(embedding)
                    embedded_count += 1
                
                time.sleep(0.5)
            else:
                failed_count += len(batch)
                logger.warning(f"Failed to get embeddings for batch of {len(batch)} papers")
                
        except Exception as e:
            logger.warning(f"Failed to embed batch of {len(batch)} papers: {str(e)}")
            failed_count += len(batch)
    
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


# Cache ranking config (load once)
_ranking_alpha = None
_ranking_beta = None

def get_ranking_config():
    """Get cached ranking config"""
    global _ranking_alpha, _ranking_beta
    if _ranking_alpha is None or _ranking_beta is None:
        _ranking_alpha, _ranking_beta = load_ranking_config()
    return _ranking_alpha, _ranking_beta

def calculate_simplified_relevance(paper):
    """
    Calculate relevance score using SIMPLIFIED algorithm (no global stats calculation).
    Uses fixed normalization values for efficiency.
    relevance_score = (1 - alpha * Rnorm) + (beta * Cnorm)
    
    Fixed normalization:
    - Max citations: 10000 (reasonable upper bound)
    - Max days since pub: 3650 (10 years)
    """
    alpha, beta = get_ranking_config()
    
    citations = paper.get('cited_by_count', 0)
    publication_date = paper.get('publication_date')
    
    # Fixed normalization values (avoid expensive global stats calculation)
    MAX_CITATIONS = 10000
    MAX_DAYS_SINCE_PUB = 3650  # 10 years
    
    # Calculate recency normalization (Rnorm)
    try:
        if publication_date:
            pub_date = datetime.strptime(publication_date, "%Y-%m-%d")
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)
            days_since_pub = (datetime.now(timezone.utc) - pub_date).days
            Rnorm = max(0, min(1, days_since_pub / MAX_DAYS_SINCE_PUB))
        else:
            Rnorm = 0
    except (ValueError, TypeError):
        Rnorm = 0
    
    # Calculate citation normalization (Cnorm)
    Cnorm = min(1, citations / MAX_CITATIONS) if MAX_CITATIONS > 0 else 0
    
    # Calculate final relevance score
    relevance_score = (1 - alpha * Rnorm) + (beta * Cnorm)
    
    return max(0, min(1, relevance_score))


def add_journal_if_not_exists(journals_collection, journal_name: str) -> bool:
    """Check if a journal exists in the journals collection and add it if not found."""
    if not journal_name or not isinstance(journal_name, str) or journal_name.strip() == '':
        return False
    
    journal_name = journal_name.strip()
    
    try:
        existing_journal = journals_collection.find_one({
            'name': {'$regex': f'^{journal_name}$', '$options': 'i'}
        })
        
        if existing_journal:
            return False
        
        journal_doc = {
            'name': journal_name,
            'added_at': datetime.now(timezone.utc),
            'paper_count': 1
        }
        journals_collection.insert_one(journal_doc)
        logger.info(f"Added new journal: {journal_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to add journal '{journal_name}': {str(e)}")
        return False


def process_staging_to_clean():
    """Process papers from from_updated_staging to papers_clean"""
    logger.info("Starting process_staging_to_clean process...")
    logger.info("This script processes staged papers: updates existing or adds new with embeddings")
    
    client = None
    try:
        client = get_mongo_client()
        db = client['verge_neuro_lit_topics']
        
        staging_collection = db['from_updated_staging']
        papers_clean_collection = db['papers_clean']
        journals_collection = db['journals']
        
        # Use estimated counts for speed with large collections
        try:
            initial_staging_count = staging_collection.estimated_document_count()
        except:
            initial_staging_count = 0
        try:
            initial_clean_count = papers_clean_collection.estimated_document_count()
        except:
            initial_clean_count = 0
        
        logger.info("Initial collection sizes (estimated):")
        logger.info(f"  from_updated_staging: {initial_staging_count:,} papers")
        logger.info(f"  papers_clean: {initial_clean_count:,} papers")
        
        total_processed = 0
        total_updated = 0
        total_inserted = 0
        total_journals_added = 0
        batch_count = 0
        max_batches = 1000000  # Safety limit
        consecutive_zero_removals = 0
        max_consecutive_zero_removals = 10
        seen_paper_ids = set()
        
        # Get max batches per run from environment (for cron job mode)
        # If set, script will exit after processing this many batches and can be restarted
        max_batches_per_run = int(os.getenv("MAX_BATCHES_PER_RUN", "0"))
        if max_batches_per_run > 0:
            logger.info(f"Cron job mode: Will process {max_batches_per_run} batches per run")
        
        while True:
            if shutdown_requested:
                logger.warning("Shutdown requested. Stopping processing.")
                break
            
            # Check if we've reached the batch limit for this run (cron job mode)
            if max_batches_per_run > 0 and batch_count >= max_batches_per_run:
                logger.info(f"Processed {batch_count} batches in this run. Exiting (will restart on next cron schedule).")
                break
            
            if batch_count >= max_batches:
                logger.error(f"Reached maximum batch limit ({max_batches}). Stopping.")
                break
            
            # Use estimated count for speed
            try:
                remaining_papers = staging_collection.estimated_document_count()
            except:
                remaining_papers = 0
            if remaining_papers == 0:
                logger.info("from_updated_staging collection is now empty - processing complete!")
                break
            
            batch_count += 1
            logger.info(f"Processing batch {batch_count} - {remaining_papers:,} papers remaining in staging")
            
            batch_size = 100
            papers = list(staging_collection.find({}).limit(batch_size))
            
            if not papers:
                logger.info("No more papers found in staging")
                break
            
            # Detect stuck papers
            current_batch_ids = {paper['_id'] for paper in papers}
            stuck_papers = current_batch_ids & seen_paper_ids
            
            if stuck_papers:
                logger.warning(f"Detected {len(stuck_papers)} stuck papers - forcefully removing")
                try:
                    result = staging_collection.delete_many({'_id': {'$in': list(stuck_papers)}})
                    logger.info(f"Force-removed {result.deleted_count} stuck papers")
                    papers = list(staging_collection.find({}).limit(batch_size))
                    if not papers:
                        break
                except Exception as e:
                    logger.error(f"Failed to force-remove stuck papers: {str(e)}")
            
            seen_paper_ids.update(current_batch_ids)
            
            papers_to_update = []
            papers_to_insert = []
            papers_to_remove = []
            
            for paper in papers:
                total_processed += 1
                original_id = paper['_id']
                doi = paper.get('doi')
                
                # Calculate relevance score
                relevance_score = calculate_simplified_relevance(paper)
                paper['relevance_score'] = relevance_score
                paper['processed_at'] = datetime.now(timezone.utc)
                paper['source_collection'] = 'from_updated_staging'
                
                # Add authors_string
                if paper.get('authors') and isinstance(paper['authors'], list):
                    paper['authors_string'] = ' | '.join(paper['authors'])
                else:
                    paper['authors_string'] = ''
                
                # Check journal
                journal_name = paper.get('journal')
                if journal_name:
                    if add_journal_if_not_exists(journals_collection, journal_name):
                        total_journals_added += 1
                
                # Check if paper exists in papers_clean by DOI
                if doi:
                    existing_paper = papers_clean_collection.find_one({'doi': doi})
                    if existing_paper:
                        # UPDATE: Preserve vector fields, update everything else
                        paper['_id'] = existing_paper['_id']  # Keep original ID
                        
                        # Preserve ALL vector-related fields
                        if existing_paper.get('vector'):
                            paper['vector'] = existing_paper['vector']
                        if existing_paper.get('vectorized_at'):
                            paper['vectorized_at'] = existing_paper['vectorized_at']
                        if existing_paper.get('vector_model'):
                            paper['vector_model'] = existing_paper['vector_model']
                        if existing_paper.get('vector_dimensions'):
                            paper['vector_dimensions'] = existing_paper['vector_dimensions']
                        
                        papers_to_update.append(paper)
                        total_updated += 1
                    else:
                        # NEW: Add with embeddings
                        papers_to_insert.append(paper)
                        total_inserted += 1
                else:
                    # No DOI, treat as new
                    papers_to_insert.append(paper)
                    total_inserted += 1
                
                papers_to_remove.append(original_id)
            
            # Update existing papers
            if papers_to_update:
                try:
                    for paper in papers_to_update:
                        papers_clean_collection.replace_one({'_id': paper['_id']}, paper)
                    logger.info(f"Batch {batch_count}: Updated {len(papers_to_update)} existing papers")
                except Exception as e:
                    logger.error(f"Failed to update papers: {str(e)}")
            
            # Insert new papers with embeddings
            if papers_to_insert:
                try:
                    embedded_count = embed_new_papers(papers_to_insert, 'staging')
                    logger.info(f"Batch {batch_count}: Added embeddings to {embedded_count}/{len(papers_to_insert)} papers")
                    
                    papers_clean_collection.insert_many(papers_to_insert)
                    logger.info(f"Batch {batch_count}: Inserted {len(papers_to_insert)} new papers to papers_clean")
                except Exception as e:
                    logger.error(f"Failed to insert papers: {str(e)}")
            
            # Remove processed papers from staging
            removed_count = 0
            if papers_to_remove:
                try:
                    result = staging_collection.delete_many({'_id': {'$in': papers_to_remove}})
                    removed_count = result.deleted_count
                    
                    if removed_count == 0:
                        consecutive_zero_removals += 1
                        if consecutive_zero_removals >= max_consecutive_zero_removals:
                            logger.error(f"Failed to remove papers for {consecutive_zero_removals} consecutive batches. Stopping.")
                            break
                    else:
                        consecutive_zero_removals = 0
                    
                    logger.info(f"Batch {batch_count}: Removed {removed_count} papers from staging")
                except Exception as e:
                    logger.error(f"Failed to remove papers: {str(e)}")
                    consecutive_zero_removals += 1
                    if consecutive_zero_removals >= max_consecutive_zero_removals:
                        break
            
            logger.info(f"Batch {batch_count} complete: {len(papers)} papers processed")
            
            # Log progress every 100 batches
            if batch_count % 100 == 0:
                logger.info(f"Progress: {total_processed:,} processed, {total_updated:,} updated, {total_inserted:,} inserted")
        
        # Final summary (use estimated counts for speed)
        try:
            final_staging_count = staging_collection.estimated_document_count()
        except:
            final_staging_count = 0
        try:
            final_clean_count = papers_clean_collection.estimated_document_count()
        except:
            final_clean_count = 0
        
        logger.info("=" * 50)
        logger.info("Staging to clean process completed:")
        logger.info(f"  Total processed: {total_processed:,}")
        logger.info(f"  Existing papers updated: {total_updated:,}")
        logger.info(f"  New papers inserted: {total_inserted:,}")
        logger.info(f"  New journals added: {total_journals_added}")
        logger.info(f"  Batches processed: {batch_count}")
        logger.info(f"  Final from_updated_staging: {final_staging_count:,} papers")
        logger.info(f"  Final papers_clean: {final_clean_count:,} papers")
        logger.info("=" * 50)
        
    except Exception as e:
        logger.error(f"Staging to clean process failed: {str(e)}")
        raise
    finally:
        if client:
            client.close()
            logger.info("Database connection closed.")


if __name__ == "__main__":
    process_staging_to_clean()

