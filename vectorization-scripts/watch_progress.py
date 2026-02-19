#!/usr/bin/env python3
"""
Live monitoring script for vectorization progress
Run this in a separate terminal to watch real-time progress
"""

import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'verge_neuro_lit_topics')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'papers_clean')
LOG_FILE = 'vectorization_log_fast.txt'

def clear_screen():
    """Clear terminal screen"""
    os.system('clear' if os.name != 'nt' else 'cls')

def get_db_progress():
    """Get progress from database"""
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]
        
        total = collection.estimated_document_count()
        vectorized = collection.count_documents({'vector': {'$exists': True}}, maxTimeMS=10000)
        
        client.close()
        return total, vectorized
    except:
        return None, None

def get_latest_logs(num_lines=15):
    """Get latest log entries"""
    try:
        with open(LOG_FILE, 'r') as f:
            lines = f.readlines()
            return lines[-num_lines:]
    except:
        return []

def watch_progress():
    """Main monitoring loop"""
    start_time = time.time()
    last_count = None
    
    print("Starting live monitoring... Press Ctrl+C to stop\n")
    time.sleep(2)
    
    while True:
        try:
            clear_screen()
            
            # Header
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print("="*80)
            print(f"  VECTORIZATION LIVE MONITOR - {current_time}")
            print("="*80)
            print()
            
            # Database progress
            total, vectorized = get_db_progress()
            
            if total and vectorized:
                remaining = total - vectorized
                progress_pct = (vectorized / total) * 100
                
                print("DATABASE STATUS:")
                print(f"   Total papers:      {total:,}")
                print(f"   Vectorized:        {vectorized:,}  ({progress_pct:.2f}%)")
                print(f"   Remaining:         {remaining:,}")
                print()
                
                # Calculate rate
                if last_count:
                    papers_added = vectorized - last_count
                    if papers_added > 0:
                        print(f"   Last 5 sec:         +{papers_added} papers")
                
                last_count = vectorized
                
                # Estimate completion
                if last_count and papers_added > 0:
                    rate_per_sec = papers_added / 5.0
                    if rate_per_sec > 0:
                        remaining_seconds = remaining / rate_per_sec
                        hours = remaining_seconds / 3600
                        minutes = (remaining_seconds % 3600) / 60
                        print(f"   Estimated time:     {hours:.0f}h {minutes:.0f}m")
                
                print()
            else:
                print("Cannot connect to database (network issue)\n")
            
            # Latest logs
            print("LATEST ACTIVITY (Live logs):")
            print("-"*80)
            
            logs = get_latest_logs(12)
            for line in logs:
                line = line.strip()
                if line:
                    # Color code errors
                    if 'Error' in line:
                        print(f"  [!] {line}")
                    elif 'Batch #' in line:
                        print(f"  [+] {line}")
                    else:
                        print(f"      {line}")
            
            print()
            print("="*80)
            print("  Press Ctrl+C to stop monitoring (script continues running)")
            print("="*80)
            
            # Update every 5 seconds
            time.sleep(5)
            
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped. Vectorization script is still running!")
            break
        except Exception as e:
            print(f"\nError: {e}")
            time.sleep(5)

if __name__ == "__main__":
    try:
        watch_progress()
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped!")
        sys.exit(0)

