"""
FAST Vectorization Script - Uses Batch Embeddings
This is 10-50x faster than the original script
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import Dict, List, Optional
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
EMBEDDING_BATCH_SIZE = 75  # Number of papers to embed in one API call (reduced to avoid rate limits)
DB_BATCH_SIZE = 600  # Number of papers to fetch/update in MongoDB at once
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')

CHECKPOINT_FILE = 'vectorization_checkpoint_fast.json'
LOG_FILE = 'vectorization_log_fast.txt'


class FastPaperVectorizer:
    """Fast vectorizer using batch embeddings"""
    
    def __init__(self):
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found")
        
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        self.mongo_client = MongoClient(
            MONGODB_URI,
            maxPoolSize=10,
            minPoolSize=2,
            maxIdleTimeMS=45000,
            socketTimeoutMS=120000,
            connectTimeoutMS=30000,
            serverSelectionTimeoutMS=30000,
            retryWrites=True,
            retryReads=True
        )
        self.db = self.mongo_client[DATABASE_NAME]
        self.collection = self.db[COLLECTION_NAME]
        
        self.processed_count = 0
        self.error_count = 0
        self.start_time = None
        self.checkpoint = self.load_checkpoint()
        
        self.log(f"Initialized Fast Vectorizer")
        self.log(f"Embedding batch size: {EMBEDDING_BATCH_SIZE}")
        self.log(f"DB batch size: {DB_BATCH_SIZE}")
    
    def log(self, message: str):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        print(log_message)
        with open(LOG_FILE, 'a') as f:
            f.write(log_message + '\n')
    
    def load_checkpoint(self) -> Dict:
        if os.path.exists(CHECKPOINT_FILE):
            with open(CHECKPOINT_FILE, 'r') as f:
                return json.load(f)
        return {'processed_count': 0, 'last_id': None}
    
    def save_checkpoint(self, last_id: str):
        checkpoint = {
            'processed_count': self.processed_count,
            'last_id': last_id,
            'timestamp': datetime.now().isoformat()
        }
        with open(CHECKPOINT_FILE, 'w') as f:
            json.dump(checkpoint, f, indent=2)
    
    def prepare_text(self, paper: Dict) -> str:
        """Prepare text for embedding"""
        text_parts = []
        
        if paper.get('title'):
            text_parts.append(f"Title: {paper['title']}")
        
        if paper.get('abstract'):
            text_parts.append(f"Abstract: {paper['abstract']}")
        
        if paper.get('authors_string'):
            text_parts.append(f"Authors: {paper['authors_string']}")
        elif paper.get('authors') and isinstance(paper['authors'], list):
            authors = ', '.join([a.get('name', '') for a in paper['authors'] if isinstance(a, dict)])
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
    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts in one API call"""
        try:
            response = self.openai_client.embeddings.create(
                input=texts,
                model=EMBEDDING_MODEL
            )
            # Sort by index to ensure correct order
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]
        except Exception as e:
            self.log(f"Error in batch embedding: {str(e)}")
            raise
    
    def get_papers_batch(self, batch_size: int, last_id: Optional[str] = None) -> List[Dict]:
        """Get papers without vectors"""
        query = {'vector': {'$exists': False}}
        if last_id:
            query['_id'] = {'$gt': last_id}
        
        return list(self.collection.find(query).sort('_id', 1).limit(batch_size))
    
    def process_batch(self, papers: List[Dict]) -> int:
        """Process a batch of papers with batch embeddings"""
        if not papers:
            return 0
        
        # Prepare all texts
        paper_text_pairs = []
        for paper in papers:
            try:
                text = self.prepare_text(paper)
                if text.strip():
                    paper_text_pairs.append((paper, text))
            except Exception as e:
                self.log(f"Error preparing text for {paper.get('_id')}: {e}")
                self.error_count += 1
        
        if not paper_text_pairs:
            return 0
        
        # Split into embedding batches
        successful = 0
        for i in range(0, len(paper_text_pairs), EMBEDDING_BATCH_SIZE):
            batch = paper_text_pairs[i:i + EMBEDDING_BATCH_SIZE]
            batch_papers = [p for p, _ in batch]
            batch_texts = [t for _, t in batch]
            
            try:
                # Get embeddings for entire batch in ONE API call
                embeddings = self.get_batch_embeddings(batch_texts)
                
                # Prepare MongoDB updates
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
                
                # Bulk write to MongoDB
                if updates:
                    result = self.collection.bulk_write(updates, ordered=False)
                    successful += result.modified_count
                
                # Add small delay between batches to respect rate limits
                time.sleep(1.3)  # 1 second pause between embedding batches to avoid rate limits
                
            except Exception as e:
                self.log(f"Error processing embedding batch: {e}")
                self.error_count += len(batch)
        
        return successful
    
    def vectorize_all(self):
        """Main vectorization loop"""
        self.start_time = time.time()
        
        self.log("="*80)
        self.log(f"Starting FAST vectorization")
        self.log("Skipping slow count operations - will process until no papers remain")
        self.log("="*80)
        
        last_id = self.checkpoint.get('last_id')
        batch_count = 0
        
        while True:
            try:
                papers = self.get_papers_batch(DB_BATCH_SIZE, last_id)
                
                if not papers:
                    self.log("No more papers to process!")
                    break
                
                successful = self.process_batch(papers)
                self.processed_count += successful
                batch_count += 1
                
                last_id = papers[-1]['_id']
                self.save_checkpoint(last_id)
                
                # Log progress after every batch
                elapsed = time.time() - self.start_time
                rate = self.processed_count / elapsed if elapsed > 0 else 0
                self.log(f"Batch #{batch_count} | Processed: {self.processed_count:,} papers | "
                       f"Rate: {rate:.1f} papers/sec | "
                       f"Batch size: {successful} | "
                       f"Time: {elapsed/60:.1f} min")
                    
            except Exception as e:
                self.log(f"Error in main loop: {e}")
                self.log("Saving checkpoint and continuing...")
                time.sleep(5)  # Brief pause before retry
                continue
        
        # Final summary
        elapsed = time.time() - self.start_time
        self.log("="*80)
        self.log(f"Vectorization complete!")
        self.log(f"Total processed: {self.processed_count:,}")
        self.log(f"Errors: {self.error_count}")
        self.log(f"Time: {elapsed/3600:.2f} hours")
        self.log(f"Average rate: {self.processed_count/elapsed:.2f} papers/second")
        self.log("="*80)
    
    def cleanup(self):
        if self.mongo_client:
            self.mongo_client.close()


def main():
    print("="*80)
    print("FAST Paper Vectorization (Batch Embeddings)")
    print("="*80)
    
    try:
        vectorizer = FastPaperVectorizer()
        vectorizer.vectorize_all()
    except KeyboardInterrupt:
        print("\n\nInterrupted. Progress saved. Run again to resume.")
    except Exception as e:
        print(f"\n\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if 'vectorizer' in locals():
            vectorizer.cleanup()


if __name__ == "__main__":
    main()

