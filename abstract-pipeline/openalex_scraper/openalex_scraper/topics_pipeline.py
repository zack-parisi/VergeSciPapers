import pymongo
from pymongo.errors import OperationFailure
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem, CloseSpider
from twisted.internet import reactor
import os
from dotenv import load_dotenv
from datetime import datetime
import certifi
from pymongo import ReplaceOne, UpdateOne, InsertOne
import json
import logging

load_dotenv()

class TopicsMongoPipeline:
    collection_name = "papers_staging"  # Writing to staging collection in topics database

    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.mongo_db = "verge_neuro_lit_topics"  # New topics database
        self.processed_items = 0
        self.saved_items = 0
        self.bulk_operations = []
        self.bulk_size = 50  # Process in batches of 50 for efficiency
        try:
            with open('config.json', 'r') as f:
                config = json.load(f)
                self.database_max_size = config.get("database_max_size", 10000)
                self.curate_database_size = config.get("curate_database_size", True)
        except FileNotFoundError:
            self.database_max_size = 10000
            self.curate_database_size = True

    def open_spider(self, spider):
        self.client = pymongo.MongoClient(
            self.mongo_uri, 
            tlsCAFile=certifi.where(),
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            serverSelectionTimeoutMS=30000,  # Increased timeout
            socketTimeoutMS=30000,
            connectTimeoutMS=30000,  # Increased timeout
            retryWrites=True,
            w='majority'
        )
        self.db = self.client[self.mongo_db]
        self._ensure_indexes()
        spider.logger.info(f"[TopicsMongoPipeline] Connected to MongoDB. Writing to {self.mongo_db}.{self.collection_name}")

    def _ensure_indexes(self):
        collection = self.db[self.collection_name]
        collection.create_index("_id")
        collection.create_index("publication_date")
        collection.create_index("title")
        collection.create_index("matching_topics")  # New index for topic matching
        collection.create_index("topic_relevance_score")  # New index for topic relevance

    def close_spider(self, spider):
        if self.bulk_operations:
            self._execute_bulk_operations()
        spider.logger.info(f"[TopicsMongoPipeline] Final stats: {self.processed_items:,} items processed, {self.saved_items:,} items saved")
        self.client.close()

    def _execute_bulk_operations(self):
        if not self.bulk_operations:
            return
        try:
            result = self.db[self.collection_name].bulk_write(self.bulk_operations, ordered=False)
            self.saved_items += len(self.bulk_operations)
            self.bulk_operations = []
            return result
        except Exception as e:
            logging.error(f"Bulk operation failed: {e}")
            # Fallback to individual inserts
            for operation in self.bulk_operations:
                try:
                    if isinstance(operation, InsertOne):
                        self.db[self.collection_name].insert_one(operation._doc)
                    elif isinstance(operation, ReplaceOne):
                        self.db[self.collection_name].replace_one(operation._filter, operation._doc, upsert=True)
                    self.saved_items += 1
                except Exception as op_error:
                    logging.error(f"Individual operation failed: {op_error}")
            self.bulk_operations = []

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        document = adapter.asdict()
        
        # Handle both source_id and _id fields
        source_id = document.pop("source_id", None)
        item_id = document.pop("_id", None)
        
        # Use whichever ID is available
        if source_id:
            document["_id"] = source_id
        elif item_id:
            document["_id"] = item_id
        else:
            spider.logger.error("Item missing both source_id and _id, skipping")
            return item
            
        document["created_at"] = datetime.utcnow()
        document["updated_at"] = datetime.utcnow()
        
        # Add topic-specific metadata
        if 'matching_topics' not in document:
            document['matching_topics'] = []
        if 'topic_relevance_score' not in document:
            document['topic_relevance_score'] = 0.0
        
        # Add to bulk operations
        self.bulk_operations.append(InsertOne(document))
        self.processed_items += 1
        
        # Execute bulk operations when batch is full
        if len(self.bulk_operations) >= self.bulk_size:
            self._execute_bulk_operations()
            spider.logger.info(f"[TopicsMongoPipeline] Processed {self.processed_items:,} items, saved {self.saved_items:,} items")
        
        return item 