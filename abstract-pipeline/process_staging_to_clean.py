import os
import pymongo
import certifi
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import time
import json

# Load configuration for ranking algorithm
def load_ranking_config():
    """Load ranking algorithm configuration from config.json"""
    try:
        with open('config.json', 'r') as f:
            config = json.load(f)
            ranking_config = config.get("ranking_algorithm", {"alpha": 0.4, "beta": 0.6})
            return ranking_config.get("alpha", 0.4), ranking_config.get("beta", 0.6)
    except FileNotFoundError:
        print("Warning: config.json not found. Using default ranking parameters.")
        return 0.4, 0.6

# Advanced relevance calculation using the sophisticated ranking algorithm
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
    
    return max(0, min(1, relevance_score))  # Ensure score is between 0 and 1

def calculate_global_stats(collection):
    """Calculate global statistics needed for normalization"""
    print("Calculating global statistics for relevance scoring...")
    
    # Get max citations and oldest publication date
    pipeline = [
        {
            "$group": {
                "_id": None,
                "max_citations": {"$max": "$cited_by_count"},
                "min_pub_date": {"$min": {"$dateFromString": {"dateString": "$publication_date"}}}
            }
        }
    ]
    
    result = list(collection.aggregate(pipeline))
    if not result:
        return {"max_citations": 1, "max_days_since_pub": 1}
    
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
    
    print(f"Global stats - Max citations: {max_citations}, Max days since pub: {max_days_since_pub}")
    return global_stats

# Legacy simple calculation (kept for reference but not used)
def calculate_relevance(paper):
    # Example: use cited_by_count as a proxy
    return float(paper.get('cited_by_count', 0)) / 1000.0

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "verge_neuro_lit"
STAGING = "papers_staging"
CLEAN = "papers_clean"
MAX_SIZE = int(os.getenv("DB_MAX_SIZE", 1000000))

client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client[DB_NAME]
staging = db[STAGING]
clean = db[CLEAN]

logging.basicConfig(level=logging.INFO)

REQUIRED_FIELDS = ["abstract", "publication_date", "cited_by_count"]

def is_valid_paper(paper):
    return all(paper.get(field) not in (None, "", []) for field in REQUIRED_FIELDS)

def process_paper(paper, global_stats):
    paper_id = paper["_id"]
    # Validation
    if not is_valid_paper(paper):
        logging.info(f"SKIPPED (invalid): {paper_id} (missing required fields)")
        # Optionally, delete from staging here
        staging.delete_one({"_id": paper_id})
        return None
    
    # Calculate advanced relevance score
    paper["relevance_score"] = calculate_advanced_relevance(paper, global_stats)
    paper["updated_at"] = datetime.utcnow()
    
    # Always upsert if exists
    if clean.count_documents({"_id": paper_id}, limit=1) > 0:
        clean.replace_one({"_id": paper_id}, paper, upsert=True)
        logging.info(f"Upserted existing paper: {paper_id} (score: {paper['relevance_score']:.3f})")
        return paper_id
    
    # If at or above max size, compare relevance
    current_count = clean.count_documents({})
    if current_count >= MAX_SIZE:
        lowest = clean.find({"relevance_score": {"$exists": True}}).sort("relevance_score", 1).limit(1)
        lowest_doc = next(lowest, None)
        if lowest_doc and paper["relevance_score"] > lowest_doc.get("relevance_score", 0):
            clean.delete_one({"_id": lowest_doc["_id"]})
            clean.replace_one({"_id": paper_id}, paper, upsert=True)
            logging.info(f"DB full. Replaced lowest ({lowest_doc['_id']}, score={lowest_doc['relevance_score']:.3f}) with {paper_id} (score={paper['relevance_score']:.3f})")
        else:
            logging.info(f"DB full. Skipped {paper_id} (score={paper['relevance_score']:.3f}) not more relevant than lowest (score={lowest_doc.get('relevance_score', 0):.3f if lowest_doc else 'N/A'})")
            return None
    else:
        clean.replace_one({"_id": paper_id}, paper, upsert=True)
        logging.info(f"Inserted new paper: {paper_id} (score: {paper['relevance_score']:.3f})")
    return paper_id

def main():
    start = time.time()
    
    # Calculate global statistics for normalization
    global_stats = calculate_global_stats(clean)
    
    papers = list(staging.find())
    logging.info(f"Processing {len(papers)} papers from staging...")
    processed = 0
    skipped = 0
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(process_paper, paper, global_stats): paper["_id"] for paper in papers}
        for future in as_completed(futures):
            result = future.result()
            if result:
                processed += 1
            else:
                skipped += 1
    
    # Delete all processed papers from staging (should be empty except for errors)
    if papers:
        ids = [paper["_id"] for paper in papers]
        staging.delete_many({"_id": {"$in": ids}})
        logging.info(f"Deleted {len(ids)} papers from staging.")
    
    logging.info(f"Done. Processed {processed} valid papers, skipped {skipped} invalid papers in {time.time() - start:.2f}s.")

if __name__ == "__main__":
    main() 