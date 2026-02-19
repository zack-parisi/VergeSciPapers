#!/usr/bin/env python3
"""
Save all unvectorized paper IDs to a file - no prompts
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'verge_neuro_lit_topics')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'papers_clean')

def main():
    print("="*80)
    print("Finding and saving unvectorized paper IDs...")
    print("="*80)
    print()
    
    # Connect to MongoDB
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    # Count papers without vector_dimensions
    query = {'vector_dimensions': {'$exists': False}}
    
    print("Counting unvectorized papers...")
    total_count = collection.count_documents(query)
    
    print(f"Found {total_count:,} papers without vector_dimensions")
    print()
    
    if total_count == 0:
        print("All papers have been vectorized!")
        client.close()
        return
    
    # Save to file
    output_file = f'unvectorized_paper_ids_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    
    print(f"Fetching all {total_count:,} paper IDs...")
    paper_ids = [doc['_id'] for doc in collection.find(query, {'_id': 1})]
    
    with open(output_file, 'w') as f:
        json.dump({
            'count': len(paper_ids),
            'timestamp': datetime.now().isoformat(),
            'paper_ids': paper_ids
        }, f, indent=2)
    
    print(f"Saved {len(paper_ids):,} paper IDs to: {output_file}")
    print()
    
    # Show first few
    print("First 10 IDs:")
    for i, paper_id in enumerate(paper_ids[:10], 1):
        print(f"  {i}. {paper_id}")
    
    if len(paper_ids) > 10:
        print(f"  ... and {len(paper_ids) - 10:,} more")
    
    print()
    print("="*80)
    print("Summary:")
    print(f"  Total papers in collection: {collection.count_documents({}):,}")
    print(f"  Papers with vectors: {collection.count_documents({'vector_dimensions': {'$exists': True}}):,}")
    print(f"  Papers without vectors: {total_count:,}")
    print(f"  Saved to: {output_file}")
    print("="*80)
    
    client.close()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

