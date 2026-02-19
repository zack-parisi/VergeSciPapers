"""
Vectorization Script for Neuroscience Papers Database
This script vectorizes papers in MongoDB using OpenAI's embedding API.
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from openai import OpenAI
from tqdm import tqdm
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Load environment variables
load_dotenv()

# Configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'verge_neuro_lit_topics')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'papers_clean')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
BATCH_SIZE = int(os.getenv('BATCH_SIZE', 100))
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')
MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))

# Checkpoint file to track progress
CHECKPOINT_FILE = 'vectorization_checkpoint.json'
LOG_FILE = 'vectorization_log.txt'


class VectorizationError(Exception):
    """Custom exception for vectorization errors"""
    pass


class PaperVectorizer:
    """Handles vectorization of papers in MongoDB using OpenAI embeddings"""
    
    def __init__(self):
        """Initialize the vectorizer with MongoDB and OpenAI clients"""
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        self.mongo_client = MongoClient(MONGODB_URI)
        self.db = self.mongo_client[DATABASE_NAME]
        self.collection = self.db[COLLECTION_NAME]
        
        self.processed_count = 0
        self.error_count = 0
        self.start_time = None
        self.checkpoint = self.load_checkpoint()
        
        self.log(f"Initialized PaperVectorizer")
        self.log(f"Database: {DATABASE_NAME}")
        self.log(f"Collection: {COLLECTION_NAME}")
        self.log(f"Embedding Model: {EMBEDDING_MODEL}")
    
    def log(self, message: str):
        """Log messages to both console and file"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        print(log_message)
        
        with open(LOG_FILE, 'a') as f:
            f.write(log_message + '\n')
    
    def load_checkpoint(self) -> Dict:
        """Load checkpoint from file if exists"""
        if os.path.exists(CHECKPOINT_FILE):
            with open(CHECKPOINT_FILE, 'r') as f:
                checkpoint = json.load(f)
                self.log(f"Loaded checkpoint: {checkpoint['processed_count']} papers already processed")
                return checkpoint
        return {'processed_count': 0, 'last_id': None}
    
    def save_checkpoint(self, last_id: str):
        """Save current progress to checkpoint file"""
        checkpoint = {
            'processed_count': self.processed_count,
            'last_id': last_id,
            'timestamp': datetime.now().isoformat()
        }
        with open(CHECKPOINT_FILE, 'w') as f:
            json.dump(checkpoint, f, indent=2)
    
    def prepare_text_for_embedding(self, paper: Dict) -> str:
        """
        Prepare comprehensive text from paper data for embedding.
        Includes title, abstract, authors, keywords, and other relevant fields.
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
            authors = ', '.join([a.get('name', '') for a in paper['authors'] if isinstance(a, dict)])
            if authors:
                text_parts.append(f"Authors: {authors}")
        
        # Journal
        if paper.get('journal'):
            text_parts.append(f"Journal: {paper['journal']}")
        
        # Keywords
        if paper.get('keywords') and isinstance(paper['keywords'], list):
            keywords = ', '.join([k if isinstance(k, str) else str(k) for k in paper['keywords']])
            if keywords:
                text_parts.append(f"Keywords: {keywords}")
        
        # Subfields
        if paper.get('subfields') and isinstance(paper['subfields'], list):
            subfields = ', '.join([s if isinstance(s, str) else str(s) for s in paper['subfields']])
            if subfields:
                text_parts.append(f"Subfields: {subfields}")
        
        # MeSH terms (medical subject headings - important for biomedical papers)
        if paper.get('mesh_terms') and isinstance(paper['mesh_terms'], list):
            mesh = ', '.join([m if isinstance(m, str) else str(m) for m in paper['mesh_terms'][:10]])  # Limit to first 10
            if mesh:
                text_parts.append(f"MeSH Terms: {mesh}")
        
        # Combine all parts
        full_text = ' | '.join(text_parts)
        
        # Truncate if too long (OpenAI has token limits)
        # text-embedding-3-small supports up to 8191 tokens
        # Roughly 4 characters per token, so limit to ~24000 characters to be safer
        # This leaves room for token encoding variations
        if len(full_text) > 24000:
            full_text = full_text[:24000] + "..."
        
        return full_text
    
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type((Exception,))
    )
    def get_embedding(self, text: str) -> List[float]:
        """
        Get embedding from OpenAI API with retry logic.
        Uses text-embedding-3-small by default (1536 dimensions, cost-effective).
        """
        try:
            response = self.openai_client.embeddings.create(
                input=text,
                model=EMBEDDING_MODEL
            )
            return response.data[0].embedding
        except Exception as e:
            self.log(f"Error getting embedding: {str(e)}")
            raise
    
    def get_papers_batch(self, batch_size: int, last_id: Optional[str] = None) -> List[Dict]:
        """Get a batch of papers that don't have vectors yet"""
        query = {'vector': {'$exists': False}}
        
        if last_id:
            query['_id'] = {'$gt': last_id}
        
        papers = list(self.collection.find(query).sort('_id', 1).limit(batch_size))
        return papers
    
    def vectorize_batch(self, papers: List[Dict]) -> int:
        """Vectorize a batch of papers and update them in MongoDB"""
        if not papers:
            return 0
        
        updates = []
        successful = 0
        
        for paper in papers:
            try:
                # Prepare text for embedding
                text = self.prepare_text_for_embedding(paper)
                
                if not text.strip():
                    self.log(f"Warning: Empty text for paper {paper['_id']}, skipping")
                    continue
                
                # Get embedding from OpenAI
                vector = self.get_embedding(text)
                
                # Prepare update operation
                updates.append(
                    UpdateOne(
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
                )
                successful += 1
                
                # Small delay to respect rate limits
                time.sleep(0.05)
                
            except Exception as e:
                self.error_count += 1
                self.log(f"Error processing paper {paper.get('_id', 'unknown')}: {str(e)}")
                continue
        
        # Bulk update MongoDB
        if updates:
            try:
                result = self.collection.bulk_write(updates)
                self.log(f"Updated {result.modified_count} papers in database")
            except Exception as e:
                self.log(f"Error during bulk write: {str(e)}")
                raise
        
        return successful
    
    def get_total_papers(self) -> int:
        """Get total count of papers without vectors"""
        return self.collection.count_documents({'vector': {'$exists': False}})
    
    def get_total_papers_in_collection(self) -> int:
        """Get total count of all papers in collection"""
        return self.collection.count_documents({})
    
    def get_vectorized_count(self) -> int:
        """Get count of papers that have been vectorized"""
        return self.collection.count_documents({'vector': {'$exists': True}})
    
    def vectorize_all(self):
        """Main method to vectorize all papers in the database"""
        self.start_time = time.time()
        
        # Get counts
        total_papers = self.get_total_papers_in_collection()
        already_vectorized = self.get_vectorized_count()
        remaining = self.get_total_papers()
        
        self.log("="*80)
        self.log(f"Starting vectorization process")
        self.log(f"Total papers in collection: {total_papers:,}")
        self.log(f"Already vectorized: {already_vectorized:,}")
        self.log(f"Remaining to vectorize: {remaining:,}")
        self.log("="*80)
        
        if remaining == 0:
            self.log("All papers are already vectorized!")
            return
        
        # Process in batches
        last_id = self.checkpoint.get('last_id')
        
        with tqdm(total=remaining, desc="Vectorizing papers") as pbar:
            while True:
                # Get batch of papers
                papers = self.get_papers_batch(BATCH_SIZE, last_id)
                
                if not papers:
                    self.log("No more papers to process")
                    break
                
                # Vectorize the batch
                successful = self.vectorize_batch(papers)
                self.processed_count += successful
                
                # Update progress
                pbar.update(successful)
                
                # Save checkpoint
                last_id = papers[-1]['_id']
                self.save_checkpoint(last_id)
                
                # Log progress periodically
                if self.processed_count % 1000 == 0:
                    elapsed = time.time() - self.start_time
                    rate = self.processed_count / elapsed
                    self.log(f"Progress: {self.processed_count:,} papers processed "
                           f"({rate:.2f} papers/sec, {self.error_count} errors)")
        
        # Final summary
        elapsed = time.time() - self.start_time
        self.log("="*80)
        self.log(f"Vectorization complete!")
        self.log(f"Total processed: {self.processed_count:,}")
        self.log(f"Errors: {self.error_count}")
        self.log(f"Time elapsed: {elapsed/60:.2f} minutes")
        self.log(f"Average rate: {self.processed_count/elapsed:.2f} papers/second")
        self.log("="*80)
        
        # Verify final counts
        final_vectorized = self.get_vectorized_count()
        self.log(f"Final vectorized count: {final_vectorized:,}")
    
    def cleanup(self):
        """Clean up connections"""
        if self.mongo_client:
            self.mongo_client.close()
            self.log("MongoDB connection closed")


def main():
    """Main entry point"""
    print("="*80)
    print("Paper Vectorization Script")
    print("This will vectorize all papers in the MongoDB database")
    print("="*80)
    
    try:
        vectorizer = PaperVectorizer()
        vectorizer.vectorize_all()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user. Progress has been saved.")
        print("You can resume by running the script again.")
    except Exception as e:
        print(f"\n\nFATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if 'vectorizer' in locals():
            vectorizer.cleanup()


if __name__ == "__main__":
    main()

