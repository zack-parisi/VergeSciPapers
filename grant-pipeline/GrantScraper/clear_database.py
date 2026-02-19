#!/usr/bin/env python3
"""
Utility script to clear MongoDB database for the grant scraper.
Provides options to clear all data or clear specific spiders.
"""

import os
import sys
import logging
from dotenv import load_dotenv
import pymongo
from pymongo.errors import PyMongoError

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def connect_to_mongodb():
    """Connect to MongoDB and return collection."""
    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        logger.error("MONGODB_URI not found in environment variables")
        return None, None
    
    try:
        client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        
        db = client["verge_neuro_grants"]
        collection = db["grants_clean"]
        
        logger.info("Successfully connected to MongoDB")
        return client, collection
    except PyMongoError as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return None, None


def clear_all_data():
    """Clear all data from the grants collection."""
    client, collection = connect_to_mongodb()
    if client is None or collection is None:
        return False
    
    try:
        count_before = collection.count_documents({})
        logger.info(f"Found {count_before} documents in collection")
        
        if count_before == 0:
            logger.info("Collection is already empty")
            client.close()
            return True
        
        result = collection.delete_many({})
        deleted_count = result.deleted_count
        
        logger.info(f"Successfully cleared {deleted_count} documents from collection")
        
        count_after = collection.count_documents({})
        logger.info(f"Documents remaining: {count_after}")
        
        client.close()
        return True
        
    except PyMongoError as e:
        logger.error(f"Error clearing data: {e}")
        if client:
            client.close()
        return False


def clear_spider_data(spider_name):
    """Clear data for a specific spider."""
    client, collection = connect_to_mongodb()
    if client is None or collection is None:
        return False
    
    try:
        count_before = collection.count_documents({"spider": spider_name})
        logger.info(f"Found {count_before} documents for spider '{spider_name}'")
        
        if count_before == 0:
            logger.info(f"No documents found for spider '{spider_name}'")
            client.close()
            return True
        
        result = collection.delete_many({"spider": spider_name})
        deleted_count = result.deleted_count
        
        logger.info(f"Successfully cleared {deleted_count} documents for spider '{spider_name}'")
        
        count_after = collection.count_documents({"spider": spider_name})
        logger.info(f"Documents remaining for spider '{spider_name}': {count_after}")
        
        client.close()
        return True
        
    except PyMongoError as e:
        logger.error(f"Error clearing spider data: {e}")
        if client:
            client.close()
        return False


def list_spiders():
    """List all spiders that have data in the collection."""
    client, collection = connect_to_mongodb()
    if client is None or collection is None:
        return False
    
    try:
        # Get unique spider names
        spider_names = collection.distinct("spider")
        
        if not spider_names:
            logger.info("No spiders found in collection")
            client.close()
            return True
        
        logger.info("Spiders with data in collection:")
        for spider_name in sorted(spider_names):
            count = collection.count_documents({"spider": spider_name})
            logger.info(f"  - {spider_name}: {count} documents")
        
        client.close()
        return True
        
    except PyMongoError as e:
        logger.error(f"Error listing spiders: {e}")
        if client:
            client.close()
        return False


def show_collection_stats():
    """Show statistics about the collection."""
    client, collection = connect_to_mongodb()
    if client is None or collection is None:
        return False
    
    try:
        total_docs = collection.count_documents({})
        logger.info(f"Total documents: {total_docs}")
        
        if total_docs > 0:
            # Get unique agencies
            agencies = collection.distinct("agency")
            logger.info(f"Unique agencies: {len(agencies)}")
            for agency in sorted(agencies):
                count = collection.count_documents({"agency": agency})
                logger.info(f"  - {agency}: {count} documents")
            
            # Get unique spiders
            spiders = collection.distinct("spider")
            logger.info(f"Unique spiders: {len(spiders)}")
            for spider in sorted(spiders):
                count = collection.count_documents({"spider": spider})
                logger.info(f"  - {spider}: {count} documents")
        
        client.close()
        return True
        
    except PyMongoError as e:
        logger.error(f"Error getting collection stats: {e}")
        if client:
            client.close()
        return False


def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) < 2:
        logger.error("Usage: python clear_database.py [all|spider_name|list|stats]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "all":
        logger.info("Clearing all data from database...")
        if clear_all_data():
            logger.info("Database cleared successfully")
        else:
            logger.error("Failed to clear database")
            sys.exit(1)
    
    elif command == "list":
        logger.info("Listing spiders with data...")
        if not list_spiders():
            logger.error("Failed to list spiders")
            sys.exit(1)
    
    elif command == "stats":
        logger.info("Showing collection statistics...")
        if not show_collection_stats():
            logger.error("Failed to get collection stats")
            sys.exit(1)
    
    else:
        # Assume it's a spider name
        spider_name = sys.argv[1]
        logger.info(f"Clearing data for spider '{spider_name}'...")
        if clear_spider_data(spider_name):
            logger.info(f"Spider '{spider_name}' data cleared successfully")
        else:
            logger.error(f"Failed to clear data for spider '{spider_name}'")
            sys.exit(1)


if __name__ == "__main__":
    main() 