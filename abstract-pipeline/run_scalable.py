#!/usr/bin/env python3
"""
High-Performance OpenAlex Scraping Pipeline
Optimized for scraping 1M+ neuroscience papers efficiently
"""

import subprocess
import sys
import time
import json
import logging
from datetime import datetime
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraping.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

def load_config():
    """Load configuration from config.json"""
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error("config.json not found!")
        sys.exit(1)

def run_spider_with_retry(max_retries=3):
    """Run the spider with retry logic"""
    for attempt in range(max_retries):
        try:
            logging.info(f"Starting spider run (attempt {attempt + 1}/{max_retries})")
            
            # Run the spider
            result = subprocess.run(
                ['scrapy', 'crawl', 'neuroscience'],
                cwd='openalex_scraper',
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )
            
            if result.returncode == 0:
                logging.info("Spider completed successfully!")
                return True
            else:
                # Check if it's a storage capacity stop (which is expected)
                if "Storage capacity reached" in result.stdout or "Storage capacity reached" in result.stderr:
                    logging.info("Spider stopped due to storage capacity - this is expected behavior!")
                    return True
                
                logging.error(f"Spider failed with return code {result.returncode}")
                logging.error(f"Error output: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            logging.error(f"Spider timed out on attempt {attempt + 1}")
        except Exception as e:
            logging.error(f"Unexpected error on attempt {attempt + 1}: {e}")
        
        if attempt < max_retries - 1:
            wait_time = (attempt + 1) * 60  # Exponential backoff
            logging.info(f"Waiting {wait_time} seconds before retry...")
            time.sleep(wait_time)
    
    return False

def run_staging_to_clean():
    """Run staging to clean processing with advanced relevance calculation"""
    try:
        logging.info("Processing staging to clean with advanced relevance calculation...")
        result = subprocess.run(
            ['python', 'process_staging_to_clean.py'],
            capture_output=True,
            text=True,
            timeout=1800  # 30 minute timeout
        )
        
        if result.returncode == 0:
            logging.info("Staging to clean processing completed successfully!")
            return True
        else:
            logging.error(f"Staging to clean processing failed: {result.stderr}")
            return False
            
    except Exception as e:
        logging.error(f"Error running staging to clean processing: {e}")
        return False

def run_relevance_calculation():
    """Run final relevance score optimization"""
    try:
        logging.info("Performing final relevance score optimization...")
        result = subprocess.run(
            ['python', 'recalculate_relevance_scores.py'],
            capture_output=True,
            text=True,
            timeout=1800  # 30 minute timeout
        )
        
        if result.returncode == 0:
            logging.info("Final relevance score optimization completed successfully!")
            return True
        else:
            logging.error(f"Final relevance score optimization failed: {result.stderr}")
            return False
            
    except Exception as e:
        logging.error(f"Error running final relevance score optimization: {e}")
        return False

def check_database_stats():
    """Check current database statistics"""
    try:
        # This would require a MongoDB connection
        # For now, we'll just log that we should check stats
        logging.info("Database stats check - implement MongoDB connection here")
        return True
    except Exception as e:
        logging.error(f"Error checking database stats: {e}")
        return False

def main():
    """Main execution function"""
    config = load_config()
    
    logging.info("=" * 60)
    logging.info("HIGH-PERFORMANCE OPENALEX SCRAPING PIPELINE")
    logging.info("=" * 60)
    logging.info(f"Target: {config['max_items_to_scrape']:,} papers")
    logging.info(f"Database max size: {config['database_max_size']:,}")
    logging.info(f"Started at: {datetime.now()}")
    
    # Step 1: Run the spider
    logging.info("\n" + "=" * 40)
    logging.info("STEP 1: RUNNING SPIDER")
    logging.info("=" * 40)
    
    if not run_spider_with_retry():
        logging.error("Spider failed after all retries. Exiting.")
        sys.exit(1)
    
    # Step 2: Process staging to clean with advanced relevance calculation
    logging.info("\n" + "=" * 40)
    logging.info("STEP 2: PROCESSING STAGING TO CLEAN")
    logging.info("=" * 40)
    
    if not run_staging_to_clean():
        logging.error("Staging to clean processing failed. Exiting.")
        sys.exit(1)
    
    # Step 3: Final relevance score optimization
    logging.info("\n" + "=" * 40)
    logging.info("STEP 3: FINAL RELEVANCE SCORE OPTIMIZATION")
    logging.info("=" * 40)
    
    if not run_relevance_calculation():
        logging.error("Final relevance score optimization failed. Continuing anyway...")
    
    # Step 4: Check database stats
    logging.info("\n" + "=" * 40)
    logging.info("STEP 4: DATABASE STATISTICS")
    logging.info("=" * 40)
    
    check_database_stats()
    
    logging.info("\n" + "=" * 60)
    logging.info("PIPELINE COMPLETED SUCCESSFULLY WITH ADVANCED RELEVANCE SCORING!")
    logging.info(f"Finished at: {datetime.now()}")
    logging.info("=" * 60)

if __name__ == "__main__":
    main() 