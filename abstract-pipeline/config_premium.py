# Essential configuration for staging to clean processor
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit_topics"

COLLECTIONS = {
    "staging": "papers_staging",
    "clean": "papers_clean", 
    "topics": "topics",
    "config": "topic_config",
    "jobs": "scrape_jobs"
} 