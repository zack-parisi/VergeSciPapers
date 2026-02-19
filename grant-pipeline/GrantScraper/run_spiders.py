#!/usr/bin/env python3
"""
Script to run all neuroscience grant spiders in batches.
Optimized for performance and error handling with detailed progress logging.
"""

import subprocess
import sys
import time
import logging
from datetime import datetime
import os
import re
from typing import List, Dict, Optional
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed

# Configure logging with a cleaner format
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[
        logging.FileHandler('spider_run.log', mode='w'),  # Overwrite log file each run
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Spider configurations
SPIDER_CONFIGS = {
    "api_spiders": ["grantsgov"],
    "web_spiders": [
        "alzheimers_association",
        "brain_research_foundation",
        "wellcome_trust",
        "erc",
        "simons_foundation",
        "mcknight_foundation",
        "dana_foundation",
        "epilepsy_foundation",
        "parkinsons_foundation",
        "als_association",
        "hhmi",
        "pew_trusts",
        "burroughs_wellcome",
        "kavli_foundation",
        "chan_zuckerberg",
        "sloan_foundation",
        "american_heart"
    ]
}


class SpiderRunner:
    """Manages spider execution with error handling and monitoring."""

    def __init__(self):
        self.results: Dict[str, Dict] = {}
        self.start_time = None
        self.end_time = None

    def run_spider(self, spider_name: str, spider_type: str = "web") -> Dict:
        """Run a single spider and return results."""
        start_time = time.time()
        success = False
        error_msg = None
        grants_scraped = 0
        
        try:
            cmd = [
                "scrapy", "crawl", spider_name,
                "-s", "LOG_LEVEL=INFO",
                "-s", "CLOSESPIDER_TIMEOUT=300",
                "-s", "CLOSESPIDER_PAGECOUNT=100",
                "-s", "DOWNLOAD_DELAY=2",
                "-s", "CONCURRENT_REQUESTS_PER_DOMAIN=2"
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if result.returncode == 0:
                success = True
                # Parse grants count from spider output
                grants_scraped = self._extract_grants_count(result.stdout, result.stderr)
            else:
                error_msg = f"Return code {result.returncode}"
                if result.stderr:
                    error_msg += f": {result.stderr.strip()}"
                
        except subprocess.TimeoutExpired:
            error_msg = f"Timed out after 10 minutes"
        except Exception as e:
            error_msg = f"Unexpected error: {e}"
        
        end_time = time.time()
        duration = end_time - start_time
        
        return {
            "spider_name": spider_name,
            "success": success,
            "duration": duration,
            "error": error_msg,
            "type": spider_type,
            "grants_scraped": grants_scraped
        }

    def _extract_grants_count(self, stdout: str, stderr: str) -> int:
        """Extract the number of grants scraped from spider output."""
        # Look for patterns in the logs that indicate item count
        patterns = [
            r"Spider.*completed\. Total documents: (\d+)",  # From pipeline close_spider
            r"Inserted new grant:.*",  # Count individual insertions
            r"(\d+) item\(s\)",  # Scrapy item count format
            r"'item_scraped_count': (\d+)",  # Scrapy stats format
        ]
        
        combined_output = stdout + stderr
        
        # First try to find the total documents count from pipeline
        for pattern in patterns:
            matches = re.findall(pattern, combined_output, re.IGNORECASE)
            if matches:
                if "Total documents" in pattern:
                    return int(matches[-1])  # Take the last occurrence
                elif "Inserted new grant" in pattern:
                    return len(matches)  # Count the number of insertions
                elif "item_scraped_count" in pattern:
                    return int(matches[-1])
        
        # Count manual insertions as fallback
        insert_count = len(re.findall(r"Inserted new grant:", combined_output))
        if insert_count > 0:
            return insert_count
            
        return 0

    def run_spiders_batched(self, spider_types: Optional[List[str]] = None, batch_size: int = 4) -> Dict:
        """Run spiders in batches using multiprocessing."""
        if spider_types is None:
            spider_types = ["web_spiders", "api_spiders"]
        
        all_spiders = []
        for spider_type in spider_types:
            if spider_type in SPIDER_CONFIGS:
                all_spiders.extend(SPIDER_CONFIGS[spider_type])
        
        logger.info("=" * 60)
        logger.info(f"Starting Grant Spider Run")
        logger.info(f"Total spiders: {len(all_spiders)}")
        logger.info(f"Batch size: {batch_size}")
        logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 60)
        
        # Show spider list grouped by type
        for spider_type in spider_types:
            if spider_type in SPIDER_CONFIGS:
                spiders = SPIDER_CONFIGS[spider_type]
                logger.info(f"\n{spider_type.replace('_', ' ').title()} ({len(spiders)} spiders):")
                for spider in spiders:
                    logger.info(f"   - {spider}")
        
        logger.info(f"\nStarting spider execution...")
        
        self.start_time = time.time()
        completed_count = 0
        
        with ProcessPoolExecutor(max_workers=batch_size) as executor:
            future_to_spider = {
                executor.submit(self.run_spider, spider): spider 
                for spider in all_spiders
            }
            
            for future in as_completed(future_to_spider):
                spider = future_to_spider[future]
                completed_count += 1
                try:
                    result = future.result()
                    self.results[spider] = result
                    # Add progress indicator to the already logged message
                    progress = f"({completed_count}/{len(all_spiders)})"
                    if result["success"]:
                        grants = result.get('grants_scraped', 0)
                        duration = result.get('duration', 0)
                        logger.info(f"{spider} completed in {duration:.1f}s - {grants} grants scraped {progress}")
                    else:
                        error_msg = result.get('error', 'Unknown error')
                        logger.error(f"{spider} failed: {error_msg} {progress}")
                except Exception as e:
                    logger.error(f"{spider} generated an exception: {e} ({completed_count}/{len(all_spiders)})")
                    self.results[spider] = {
                        "spider_name": spider,
                        "success": False,
                        "duration": 0,
                        "error": str(e),
                        "type": "unknown",
                        "grants_scraped": 0
                    }
        
        self.end_time = time.time()
        return self.results

    def generate_summary(self) -> Dict:
        """Generate a summary of all spider runs."""
        if not self.results:
            return {"error": "No results available"}
        
        successful_spiders = [name for name, result in self.results.items() if result["success"]]
        failed_spiders = [name for name, result in self.results.items() if not result["success"]]
        
        total_duration = sum(result["duration"] for result in self.results.values())
        total_grants = sum(result.get("grants_scraped", 0) for result in self.results.values())
        avg_duration = total_duration / len(self.results) if self.results else 0
        
        summary = {
            "total_spiders": len(self.results),
            "successful": len(successful_spiders),
            "failed": len(failed_spiders),
            "success_rate": len(successful_spiders) / len(self.results) * 100 if self.results else 0,
            "total_duration": total_duration,
            "total_grants": total_grants,
            "average_duration": avg_duration,
            "successful_spiders": successful_spiders,
            "failed_spiders": failed_spiders,
            "detailed_results": self.results
        }
        
        return summary

    def print_summary(self):
        """Print a formatted summary of the spider run."""
        summary = self.generate_summary()
        if "error" in summary:
            logger.error(f"{summary['error']}")
            return
        
        elapsed = self.end_time - self.start_time if self.start_time and self.end_time else 0
        
        logger.info("\n" + "=" * 60)
        logger.info("SPIDER RUN SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
        logger.info(f"Spiders run: {summary['total_spiders']}")
        logger.info(f"Successful: {summary['successful']}")
        logger.info(f"Failed: {summary['failed']}")
        logger.info(f"Success rate: {summary['success_rate']:.1f}%")
        logger.info(f"Total grants scraped: {summary['total_grants']}")
        
        if summary['successful_spiders']:
            logger.info(f"\nSuccessful spiders:")
            for spider in summary['successful_spiders']:
                result = self.results[spider]
                grants = result.get('grants_scraped', 0)
                duration = result.get('duration', 0)
                logger.info(f"   {spider}: {grants} grants in {duration:.1f}s")
        
        if summary['failed_spiders']:
            logger.info(f"\nFailed spiders:")
            for spider in summary['failed_spiders']:
                result = self.results[spider]
                error = result.get('error', 'Unknown error')
                logger.info(f"   {spider}: {error}")
        
        logger.info("=" * 60)


def main():
    """Main function to run all spiders."""
    runner = SpiderRunner()
    results = runner.run_spiders_batched()
    
    # Print the formatted summary
    runner.print_summary()
    
    return runner.generate_summary()


if __name__ == "__main__":
    main() 