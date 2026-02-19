import pymongo
from pymongo.errors import OperationFailure
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem, CloseSpider
from twisted.internet import reactor
import os
from dotenv import load_dotenv
from datetime import datetime
import certifi
from pymongo import ReplaceOne, UpdateOne
import json
import logging

load_dotenv()

class MongoPipeline:
    collection_name = "papers_staging"  # Now writing to staging collection

    def __init__(self):
        self.mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.mongo_db = "verge_neuro_lit"
        self.processed_items = 0
        self.bulk_operations = []
        self.bulk_size = 100  # Process in batches of 100 for efficiency
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
            serverSelectionTimeoutMS=5000,
            socketTimeoutMS=30000,
            connectTimeoutMS=10000
        )
        self.db = self.client[self.mongo_db]
        self._ensure_indexes()
        spider.logger.info(f"[MongoPipeline] Connected to MongoDB. Writing to staging collection '{self.collection_name}'.")

    def _ensure_indexes(self):
        collection = self.db[self.collection_name]
        collection.create_index("_id")
        collection.create_index("publication_date")
        collection.create_index("title")

    def close_spider(self, spider):
        if self.bulk_operations:
            self._execute_bulk_operations()
        spider.logger.info(f"[MongoPipeline] Final stats: {self.processed_items:,} items processed")
        self.client.close()

    def _execute_bulk_operations(self):
        if not self.bulk_operations:
            return
        try:
            result = self.db[self.collection_name].bulk_write(self.bulk_operations, ordered=False)
            self.bulk_operations = []
            return result
        except Exception as e:
            logging.error(f"Bulk operation failed: {e}")
            for operation in self.bulk_operations:
                try:
                    self.db[self.collection_name].replace_one(
                        operation._filter, 
                        operation._doc, 
                        upsert=True
                    )
                except Exception as op_error:
                    logging.error(f"Individual operation failed: {op_error}")
            self.bulk_operations = []

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        document = adapter.asdict()
        document["_id"] = document.pop("source_id")
        document["created_at"] = datetime.utcnow()
        document["updated_at"] = datetime.utcnow()
        self.db[self.collection_name].replace_one({"_id": document["_id"]}, document, upsert=True)
        self.processed_items += 1
        if self.processed_items % 100 == 0:
            spider.logger.info(f"[MongoPipeline] Processed {self.processed_items:,} items (staging)")
        return item