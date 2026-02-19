#!/usr/bin/env python3
"""
Vectorize specific papers from a list of IDs
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from openai import OpenAI
from tqdm import tqdm
from tenacity import retry, stop_after_attempt, wait_exponential

load_dotenv()

# Configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'verge_neuro_lit_topics')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'papers_clean')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
EMBEDDING_MODEL = 'text-embedding-3-small'
BATCH_SIZE = 40  # Papers per embedding batch


def prepare_text_for_embedding(paper: Dict) -> str:
    """Prepare comprehensive text from paper data for embedding"""
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
    
    # Truncate if too long
    if len(full_text) > 24000:
        full_text = full_text[:24000] + "..."
    
    return full_text


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30)
)
def get_batch_embeddings(client: OpenAI, texts: List[str]) -> List[List[float]]:
    """Get embeddings for multiple texts in one API call"""
    response = client.embeddings.create(
        input=texts,
        model=EMBEDDING_MODEL
    )
    sorted_data = sorted(response.data, key=lambda x: x.index)
    return [item.embedding for item in sorted_data]


def vectorize_papers_from_ids(paper_ids: List[str]):
    """Vectorize papers from a list of IDs"""
    
    print("="*80)
    print("VECTORIZING SPECIFIC PAPERS")
    print("="*80)
    print()
    
    # Initialize clients
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    mongo_client = MongoClient(
        MONGODB_URI,
        maxPoolSize=10,
        socketTimeoutMS=120000,
        connectTimeoutMS=30000
    )
    db = mongo_client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    print(f"Total papers to vectorize: {len(paper_ids):,}")
    print()
    
    # Process in batches
    total_processed = 0
    total_errors = 0
    start_time = time.time()
    
    with tqdm(total=len(paper_ids), desc="Vectorizing", unit="papers") as pbar:
        for i in range(0, len(paper_ids), BATCH_SIZE):
            batch_ids = paper_ids[i:i + BATCH_SIZE]
            
            # Fetch papers from database
            papers = list(collection.find({'_id': {'$in': batch_ids}}))
            
            if not papers:
                pbar.update(len(batch_ids))
                continue
            
            # Prepare texts for embedding
            paper_text_pairs = []
            for paper in papers:
                text = prepare_text_for_embedding(paper)
                if text.strip():
                    paper_text_pairs.append((paper, text))
            
            if not paper_text_pairs:
                pbar.update(len(papers))
                continue
            
            try:
                # Get embeddings in batch
                batch_papers = [p for p, _ in paper_text_pairs]
                batch_texts = [t for _, t in paper_text_pairs]
                
                embeddings = get_batch_embeddings(openai_client, batch_texts)
                
                # Prepare updates
                updates = []
                for paper, embedding in zip(batch_papers, embeddings):
                    updates.append(
                        UpdateOne(
                            {'_id': paper['_id']},
                            {
                                '$set': {
                                    'vector': embedding,
                                    'vectorized_at': datetime.now(),
                                    'vector_model': EMBEDDING_MODEL,
                                    'vector_dimensions': len(embedding)
                                }
                            }
                        )
                    )
                
                # Update database
                if updates:
                    result = collection.bulk_write(updates, ordered=False)
                    total_processed += result.modified_count
                
                # Rate limiting delay
                time.sleep(1.3)
                
            except Exception as e:
                print(f"\nError processing batch: {e}")
                total_errors += len(batch_ids)
            
            pbar.update(len(papers))
    
    # Summary
    elapsed = time.time() - start_time
    print()
    print("="*80)
    print("VECTORIZATION COMPLETE")
    print("="*80)
    print(f"  Successfully vectorized: {total_processed:,}")
    print(f"  Errors: {total_errors}")
    print(f"  Time elapsed: {elapsed/60:.1f} minutes")
    print(f"  Rate: {total_processed/elapsed:.1f} papers/second")
    print("="*80)
    
    mongo_client.close()


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python vectorize_specific_papers.py <json_file>")
        print("Example: python vectorize_specific_papers.py unvectorized_paper_ids_20251014_100416.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    # Load paper IDs from JSON
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
            paper_ids = data['paper_ids']
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        sys.exit(1)
    
    print(f"Loaded {len(paper_ids):,} paper IDs from {json_file}")
    print()
    
    # Vectorize papers
    vectorize_papers_from_ids(paper_ids)


if __name__ == "__main__":
    main()

