import pymongo
import os
import sys
import json
from dotenv import load_dotenv
from datetime import datetime, timezone
import certifi

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit"
COLLECTION_NAME = "papers_clean"

def recalculate_scores_with_aggregation(force_recalculate=False):
    """
    Recalculates all relevance scores using the simplified ranking algorithm:
    ranking = (1 - alpha * Rnorm) + beta * Cnorm
    
    Where:
    - Rnorm = days since published / max days since publication in dataset
    - Cnorm = citations / max citations in dataset
    - alpha + beta = 1
    """
    try:
        client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client[MONGO_DB]
        collection = db[COLLECTION_NAME]

        # Load configuration
        try:
            with open('config.json', 'r') as f:
                config = json.load(f)
                curate_database_size = config.get("curate_database_size", True)
                database_max_size = config.get("database_max_size", 50)
                ranking_config = config.get("ranking_algorithm", {"alpha": 0.4, "beta": 0.6})
                alpha = ranking_config.get("alpha", 0.4)
                beta = ranking_config.get("beta", 0.6)
        except FileNotFoundError:
            print("Warning: config.json not found. Using default settings.")
            curate_database_size = False
            database_max_size = 50
            alpha = 0.4
            beta = 0.6

        # Validate alpha + beta = 1
        if abs(alpha + beta - 1.0) > 0.01:
            print(f"Warning: alpha ({alpha}) + beta ({beta}) should equal 1.0")

        print("Calculating global max values using aggregation...")
        meta_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "max_citations": {"$max": "$cited_by_count"},
                    "min_pub_date": {"$min": {"$dateFromString": {"dateString": "$publication_date"}}}
                }
            }
        ]
        meta_result = list(collection.aggregate(meta_pipeline))
        if not meta_result:
            print("No papers found to process.")
            return

        global_max_citations = meta_result[0].get("max_citations", 0)
        oldest_date = meta_result[0].get("min_pub_date")
        
        # Use timezone-naive UTC datetime
        global_max_days_since_pub = (datetime.utcnow() - oldest_date).days if oldest_date else 365 * 10
        if global_max_days_since_pub <= 0:
            global_max_days_since_pub = 1

        print(f"Global max_citations: {global_max_citations}")
        print(f"Global max_days_since_pub: {global_max_days_since_pub}")
        print(f"Algorithm: alpha={alpha}, beta={beta}")

        # Simplified ranking pipeline
        update_pipeline = [
            {
                "$addFields": {
                    "publication_date_obj": {"$dateFromString": {"dateString": "$publication_date"}},
                }
            },
            {
                "$addFields": {
                    "days_since_pub": {
                        "$max": [0, {"$divide": [{"$subtract": [datetime.utcnow(), "$publication_date_obj"]}, 1000 * 60 * 60 * 24]}]
                    }
                }
            },
            {
                "$addFields": {
                    "Rnorm": {
                        "$cond": {
                            "if": {"$gt": [global_max_days_since_pub, 0]},
                            "then": {"$divide": ["$days_since_pub", global_max_days_since_pub]},
                            "else": 0
                        }
                    }
                }
            },
            {
                "$addFields": {
                    "Cnorm": {
                        "$cond": {
                            "if": {"$gt": [global_max_citations, 0]},
                            "then": {"$divide": ["$cited_by_count", global_max_citations]},
                            "else": 0
                        }
                    }
                }
            },
            {
                "$addFields": {
                    "relevance_score": {
                        "$add": [
                            {"$multiply": [alpha, {"$subtract": [1, "$Rnorm"]}]},
                            {"$multiply": [beta, "$Cnorm"]}
                        ]
                    }
                }
            },
            {
                "$merge": {
                    "into": COLLECTION_NAME,
                    "on": "_id",
                    "whenMatched": "merge",
                    "whenNotMatched": "discard"
                }
            }
        ]
        
        print("Recalculating all relevance scores with simplified algorithm...")

        collection.aggregate(update_pipeline)
        print("Successfully updated relevance scores.")

        # Curation logic
        if curate_database_size:
            print(f"Curating database to {database_max_size} papers...")
            
            # Get the IDs of the top N papers by relevance_score
            ids_to_keep_pipeline = [
                {"$sort": {"relevance_score": pymongo.DESCENDING}},
                {"$limit": database_max_size},
                {"$project": {"_id": 1}}
            ]
            ids_to_keep = [doc["_id"] for doc in collection.aggregate(ids_to_keep_pipeline)]

            # Delete papers that are not in the top N
            delete_result = collection.delete_many({"_id": {"$nin": ids_to_keep}})
            print(f"Deleted {delete_result.deleted_count} papers to maintain database size.")

        # Print summary statistics
        print("\n--- Scoring Summary ---")
        stats_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "avg_relevance": {"$avg": "$relevance_score"},
                    "max_relevance": {"$max": "$relevance_score"},
                    "min_relevance": {"$min": "$relevance_score"},
                    "avg_citations": {"$avg": "$cited_by_count"},
                    "total_papers": {"$sum": 1}
                }
            }
        ]
        stats = list(collection.aggregate(stats_pipeline))
        if stats:
            stats = stats[0]
            print(f"Total papers: {stats['total_papers']}")
            print(f"Average relevance score: {stats['avg_relevance']:.3f}")
            print(f"Relevance score range: {stats['min_relevance']:.3f} - {stats['max_relevance']:.3f}")
            print(f"Average citations: {stats['avg_citations']:.1f}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    force = '--force' in sys.argv
    recalculate_scores_with_aggregation(force_recalculate=force)
