import pymongo
import os
from dotenv import load_dotenv
import certifi

load_dotenv()

def setup_mongo():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    mongo_db = "verge_neuro_lit"
    collection_name = "papers_clean"

    client = pymongo.MongoClient(mongo_uri, tlsCAFile=certifi.where())
    db = client[mongo_db]
    collection = db[collection_name]

    # Create indexes
    collection.create_index([("doi", 1)], unique=True)
    collection.create_index([("tags", 1)])
    collection.create_index([("publication_date", -1)])

    print("MongoDB setup complete. Indexes created.")
    client.close()

if __name__ == "__main__":
    setup_mongo()
