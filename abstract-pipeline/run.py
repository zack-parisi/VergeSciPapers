import os
import sys
import pymongo
import certifi
from dotenv import load_dotenv
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

# Add the scrapy project directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'openalex_scraper'))

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit"
COLLECTION_NAME = "papers_clean"

import subprocess

def run_spider_and_recalculate(force_recalculate=False):
    # No longer clearing the database for a clean test run
    # The MongoPipeline handles upserts, and recalculate_relevance_scores.py handles curation.

    # Get Scrapy project settings
    os.environ['SCRAPY_SETTINGS_MODULE'] = 'openalex_scraper.settings'
    settings = get_project_settings()
    # Ensure our custom pipelines are enabled
    settings.set('ITEM_PIPELINES', {
        'openalex_scraper.pipelines.MongoPipeline': 800,
    })
    settings.set('LOG_LEVEL', 'INFO') # Set log level to INFO to reduce verbosity
    settings.set('STATS_ENABLED', False) # Disable CoreStats to prevent shutdown errors

    try:
        process = CrawlerProcess(settings)
        process.crawl('neuroscience')
        process.start()  # The script will block here until the crawl finishes
        print("Spider run completed.")
    except Exception as e:
        print(f"An error occurred during the Scrapy crawl: {e}")
        sys.exit(1) # Exit if the spider fails

    # Step 1: Process staging to clean with advanced relevance calculation
    print("Processing staging to clean with advanced relevance calculation...")
    try:
        subprocess.run(["python3", "process_staging_to_clean.py"], check=True)
        print("Staging to clean processing completed with advanced relevance scores.")
    except subprocess.CalledProcessError as e:
        print(f"Error during staging to clean processing: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("Error: 'python3' command not found. Please ensure Python 3 is installed and in your PATH.")
        sys.exit(1)

    # Step 2: Recalculate all relevance scores based on the full dataset (optional final optimization)
    print("Performing final relevance score optimization...")
    try:
        recalc_command = ["python3", "recalculate_relevance_scores.py"]
        if force_recalculate:
            recalc_command.append("--force")
        subprocess.run(recalc_command, check=True)
        print("Final relevance score optimization completed.")
    except subprocess.CalledProcessError as e:
        print(f"Error during final relevance score optimization: {e}")
        # Don't exit here as the main processing is already done
        print("Continuing despite final optimization failure...")
    except FileNotFoundError:
        print("Error: 'python3' command not found. Please ensure Python 3 is installed and in your PATH.")
        sys.exit(1)

    print("Pipeline completed successfully with advanced relevance scoring.")

if __name__ == "__main__":
    force = '--force' in sys.argv
    run_spider_and_recalculate(force_recalculate=force)