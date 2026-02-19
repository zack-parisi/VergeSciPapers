"""
Check the progress of vectorization
"""

import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'verge_neuro_lit_topics')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'papers_clean')


def check_progress():
    """Check vectorization progress"""
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    total = collection.count_documents({})
    vectorized = collection.count_documents({'vector': {'$exists': True}})
    remaining = total - vectorized
    
    print("="*60)
    print("Vectorization Progress Report")
    print("="*60)
    print(f"Total papers in collection: {total:,}")
    print(f"Papers with vectors:        {vectorized:,}")
    print(f"Papers without vectors:     {remaining:,}")
    print(f"Progress:                   {(vectorized/total*100):.2f}%")
    print("="*60)
    
    # Check a sample vectorized paper
    if vectorized > 0:
        sample = collection.find_one({'vector': {'$exists': True}})
        if sample:
            print(f"\nSample vectorized paper:")
            print(f"  ID: {sample['_id']}")
            print(f"  Title: {sample.get('title', 'N/A')[:80]}...")
            print(f"  Vector dimensions: {sample.get('vector_dimensions', 'N/A')}")
            print(f"  Model used: {sample.get('vector_model', 'N/A')}")
            print(f"  Vectorized at: {sample.get('vectorized_at', 'N/A')}")
    
    client.close()


if __name__ == "__main__":
    check_progress()

