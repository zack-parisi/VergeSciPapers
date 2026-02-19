import os
import logging
from datetime import datetime
from dotenv import load_dotenv
import pymongo
from pymongo.errors import PyMongoError

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))


class MongoPipeline:
    """MongoDB pipeline for storing grant items with connection management and validation."""

    def __init__(self):
        """Initialize MongoDB connection and setup."""
        # Initialize logger first
        self.logger = logging.getLogger(__name__)
        
        mongo_uri = os.getenv("MONGODB_URI")
        if not mongo_uri:
            self.logger.error("MONGODB_URI not found in environment variables")
            self.client = None
            self.db = None
            self.collection = None
            return
        
        try:
            self.client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            self.client.admin.command('ping')
            
            self.db = self.client["verge_neuro_grants"]
            self.collection = self.db["grants_clean"]

            self.logger.info("MongoDB connection established successfully")
        except PyMongoError as e:
            self.logger.error(f"Failed to connect to MongoDB: {e}")
            self.client = None
            self.db = None
            self.collection = None

    def open_spider(self, spider):
        """Clear existing data for this spider when it opens."""
        if self.collection is None:
            self.logger.warning("MongoDB not available - skipping data clearing")
            return
            
        try:
            spider_name = spider.name
            deleted_count = self.collection.delete_many({"spider": spider_name}).deleted_count
            self.logger.info(f"Cleared {deleted_count} existing records for spider: {spider_name}")
            
            # Clear by agency if available
            agency = getattr(spider, 'agency_name', None)
            if agency:
                agency_deleted = self.collection.delete_many({"agency": agency}).deleted_count
                if agency_deleted > 0:
                    self.logger.info(f"Also cleared {agency_deleted} records for agency: {agency}")
            
            total_count = self.collection.count_documents({})
            self.logger.info(f"Total documents in collection after clearing: {total_count}")
            
        except PyMongoError as e:
            self.logger.error(f"Error clearing data for spider {spider.name}: {e}")

    def process_item(self, item, spider):
        """Process and validate each item before storing."""
        if self.collection is None:
            self.logger.warning("MongoDB not available - skipping item storage")
            return item
            
        try:
            if not item.get("title"):
                self.logger.warning(f"Skipping item without title from {spider.name}")
                return item
            
            item_dict = dict(item)
            item_dict["spider"] = spider.name
            item_dict["scraped_at"] = datetime.utcnow()
            item_dict = self._clean_item(item_dict)
            
            result = self.collection.update_one(
                {"title": item_dict["title"]},
                {"$set": item_dict},
                upsert=True
            )
            
            if result.upserted_id:
                self.logger.info(f"Inserted new grant: {item_dict.get('title', 'Unknown')}")
            else:
                self.logger.debug(f"Updated existing grant: {item_dict.get('title', 'Unknown')}")
                
            return item
            
        except PyMongoError as e:
            self.logger.error(f"Database error processing item: {e}")
            return item
        except Exception as e:
            self.logger.error(f"Unexpected error processing item: {e}")
            return item

    def _clean_item(self, item_dict):
        """Clean and validate item data."""
        cleaned = {k: v for k, v in item_dict.items() if v is not None}
        
        # Ensure required fields have default values
        cleaned.setdefault("title", "")
        cleaned.setdefault("agency", "")
        cleaned.setdefault("url", "")
                
        # Truncate long strings to prevent MongoDB document size issues
        max_length = 1000
        for key in ["title", "agency"]:
            if key in cleaned and len(cleaned[key]) > max_length:
                cleaned[key] = cleaned[key][:max_length] + "..."
        
        return cleaned

    def close_spider(self, spider):
        """Clean up connections when spider closes."""
        if self.collection is None:
            self.logger.warning("MongoDB not available - skipping spider completion count")
            return
            
        try:
            spider_count = self.collection.count_documents({"spider": spider.name})
            self.logger.info(f"Spider {spider.name} completed. Total documents: {spider_count}")
            
            if self.client:
                self.client.close()
                self.logger.info("MongoDB connection closed")
        except Exception as e:
            self.logger.error(f"Error closing MongoDB connection: {e}")

    def clear_all_data(self):
        """Utility method to clear all data from the collection."""
        if self.collection is None:
            self.logger.warning("MongoDB not available - cannot clear data")
            return 0
            
        try:
            deleted_count = self.collection.delete_many({}).deleted_count
            self.logger.info(f"Cleared all {deleted_count} documents from collection")
            return deleted_count
        except PyMongoError as e:
            self.logger.error(f"Error clearing all data: {e}")
            return 0
