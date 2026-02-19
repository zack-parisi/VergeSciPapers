"""
Test vectorization on a single paper to verify everything works
"""

import os
from dotenv import load_dotenv
from pymongo import MongoClient
from openai import OpenAI

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'verge_neuro_lit_topics')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'papers_clean')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')


def test_single_paper():
    """Test vectorization on a single paper"""
    print("Testing vectorization on a single paper...")
    print("="*60)
    
    # Connect to MongoDB
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    # Get a paper without vector
    paper = collection.find_one({'vector': {'$exists': False}})
    
    if not paper:
        print("No papers found without vectors. Getting any paper...")
        paper = collection.find_one({})
    
    if not paper:
        print("ERROR: No papers found in collection!")
        return
    
    print(f"Paper ID: {paper['_id']}")
    print(f"Title: {paper.get('title', 'N/A')}")
    print(f"Abstract: {paper.get('abstract', 'N/A')[:200]}...")
    print()
    
    # Prepare text
    text_parts = []
    if paper.get('title'):
        text_parts.append(f"Title: {paper['title']}")
    if paper.get('abstract'):
        text_parts.append(f"Abstract: {paper['abstract']}")
    if paper.get('authors_string'):
        text_parts.append(f"Authors: {paper['authors_string']}")
    if paper.get('keywords'):
        keywords = ', '.join([str(k) for k in paper['keywords']])
        text_parts.append(f"Keywords: {keywords}")
    
    text = ' | '.join(text_parts)
    
    print(f"Prepared text length: {len(text)} characters")
    print()
    
    # Get embedding
    print("Getting embedding from OpenAI...")
    try:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        response = openai_client.embeddings.create(
            input=text,
            model=EMBEDDING_MODEL
        )
        vector = response.data[0].embedding
        
        print(f"Successfully created embedding!")
        print(f"  Model: {EMBEDDING_MODEL}")
        print(f"  Vector dimensions: {len(vector)}")
        print(f"  First 5 values: {vector[:5]}")
        print()
        
        # Test updating in database
        print("Testing database update...")
        from datetime import datetime
        result = collection.update_one(
            {'_id': paper['_id']},
            {
                '$set': {
                    'vector': vector,
                    'vectorized_at': datetime.now(),
                    'vector_model': EMBEDDING_MODEL,
                    'vector_dimensions': len(vector)
                }
            }
        )
        
        if result.modified_count > 0:
            print("Successfully updated paper in database!")
        else:
            print("Paper already had this vector (no changes needed)")
        
        print()
        print("="*60)
        print("Test completed successfully!")
        print("You can now run the full vectorization script.")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == "__main__":
    test_single_paper()

