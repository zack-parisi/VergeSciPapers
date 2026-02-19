#!/usr/bin/env python3
import pymongo
import certifi
from config_premium import MONGO_URI, MONGO_DB, COLLECTIONS

try:
    client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client[MONGO_DB]
    
    staging = db[COLLECTIONS['staging']].count_documents({})
    clean = db[COLLECTIONS['clean']].count_documents({})
    
    print(f"Staging: {staging:,}")
    print(f"Clean: {clean:,}")
    print(f"Remaining: {staging - clean:,}")
    
    client.close()
except Exception as e:
    print(f"Error: {e}") 