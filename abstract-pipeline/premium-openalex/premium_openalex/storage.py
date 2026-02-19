import os
from typing import Dict, Iterable, Optional

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

load_dotenv()


def get_mongo_client() -> MongoClient:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    return MongoClient(uri, tlsCAFile=certifi.where())


def upsert_documents(collection_fqn: str, docs: Iterable[Dict]):
    client = get_mongo_client()
    try:
        db_name, coll_name = collection_fqn.split(".", 1)
        db = client[db_name]
        coll = db[coll_name]
        operations = []
        for d in docs:
            if "_id" not in d:
                continue
            operations.append(ReplaceOne({"_id": d["_id"]}, d, upsert=True))
        if operations:
            coll.bulk_write(operations, ordered=False)
    finally:
        client.close() 