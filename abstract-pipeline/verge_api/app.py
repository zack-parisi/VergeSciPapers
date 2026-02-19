from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sys
import os
import json
from datetime import datetime
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
import redis
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import logging
from functools import wraps
import time
import hashlib

# Add the parent directory to the path to import our Verge modules
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# Change to parent directory to access config.json
os.chdir(parent_dir)

# Import our Verge modules
from feed_generator import get_user_config, get_filtered_papers, calculate_ranks
from content_recommender import ContentRecommender
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit"
COLLECTION_NAME = "papers_clean"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))  # 5 minutes
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "4"))

# Global connections
mongo_client = None
redis_client = None
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

def init_connections():
    """Initialize database connections with connection pooling"""
    global mongo_client, redis_client
    
    try:
        # MongoDB with connection pooling
        mongo_client = MongoClient(
            MONGO_URI,
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000
        )
        
        # Test MongoDB connection
        mongo_client.admin.command('ping')
        logger.info("MongoDB connected successfully")
        
        # Redis for caching
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info("Redis connected successfully")
        
    except Exception as e:
        logger.error(f"Connection error: {e}")
        raise

def get_db():
    """Get database instance with connection pooling"""
    if not mongo_client:
        init_connections()
    return mongo_client[MONGO_DB]

def cache_key(prefix, **kwargs):
    """Generate cache key from parameters"""
    key_parts = [prefix]
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}:{v}")
    return hashlib.md5(":".join(key_parts).encode()).hexdigest()

def cached(ttl=CACHE_TTL):
    """Cache decorator with TTL"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not redis_client:
                return f(*args, **kwargs)
            
            # Generate cache key
            key = cache_key(f.__name__, *args, **kwargs)
            
            # Try to get from cache
            cached_result = redis_client.get(key)
            if cached_result:
                return json.loads(cached_result)
            
            # Execute function and cache result
            result = f(*args, **kwargs)
            if result:
                redis_client.setex(key, ttl, json.dumps(result))
            
            return result
        return decorated_function
    return decorator

def async_task(func, *args, **kwargs):
    """Execute function asynchronously"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(func(*args, **kwargs))
    finally:
        loop.close()

def health_check():
    """Comprehensive health check"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {}
    }
    
    # Check MongoDB
    try:
        db = get_db()
        db.command('ping')
        health_status["services"]["mongodb"] = "healthy"
    except Exception as e:
        health_status["services"]["mongodb"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        if redis_client:
            redis_client.ping()
            health_status["services"]["redis"] = "healthy"
        else:
            health_status["services"]["redis"] = "not_configured"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status

@app.route('/api/health', methods=['GET'])
def health_endpoint():
    """Health check endpoint"""
    return jsonify(health_check())

@app.route('/api/subfields', methods=['GET'])
@limiter.limit("100 per minute")
@cached(ttl=3600)  # Cache for 1 hour
def get_subfields():
    """Get all available subfields"""
    try:
        config = get_user_config()
        if not config:
            return jsonify({"error": "Configuration not found"}), 500
        
        subfields = []
        for subfield in config.get("enabled_subfields", []):
            subfields.append({
                "id": subfield.get("id"),
                "display_name": subfield.get("display_name"),
                "selected": False
            })
        
        return jsonify({
            "subfields": subfields,
            "total": len(subfields)
        })
    except Exception as e:
        logger.error(f"Error in get_subfields: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recommend', methods=['POST'])
@limiter.limit("30 per minute")
def get_recommendations():
    """Get ranked recommendations based on user preferences"""
    start_time = time.time()
    
    try:
        data = request.json
        selected_subfields = data.get('subfields', [])
        alpha = data.get('alpha', 0.4)
        beta = data.get('beta', 0.6)
        limit = data.get('limit', 20)
        
        # Validate parameters
        if abs(alpha + beta - 1.0) > 0.01:
            return jsonify({"error": "Alpha + Beta must equal 1.0"}), 400
        
        if not selected_subfields:
            return jsonify({"error": "At least one subfield must be selected"}), 400
        
        # Generate cache key
        cache_key_val = cache_key(
            "recommendations",
            subfields=",".join(sorted(selected_subfields)),
            alpha=alpha,
            beta=beta,
            limit=limit
        )
        
        # Try cache first
        if redis_client:
            cached_result = redis_client.get(cache_key_val)
            if cached_result:
                result = json.loads(cached_result)
                result["cached"] = True
                result["response_time"] = round((time.time() - start_time) * 1000, 2)
                return jsonify(result)
        
        # Get database connection
        db = get_db()
        
        # Get papers for selected subfields with optimized query
        filtered_papers = get_filtered_papers_optimized(db, selected_subfields, limit=1000)
        
        if not filtered_papers:
            return jsonify({
                "recommendations": [],
                "total": 0,
                "message": "No papers found for selected subfields",
                "response_time": round((time.time() - start_time) * 1000, 2)
            })
        
        # Calculate ranks using optimized algorithm
        ranked_papers = calculate_ranks_optimized(filtered_papers, alpha, beta)
        
        # Format results for frontend
        recommendations = []
        for paper in ranked_papers[:limit]:
            recommendations.append({
                "id": str(paper.get("_id", "")),
                "title": paper.get("title", "No title"),
                "abstract": paper.get("abstract", ""),
                "authors": paper.get("authors", []),
                "institutions": paper.get("institutions", []),
                "publication_date": paper.get("publication_date", ""),
                "journal": paper.get("journal", ""),
                "doi": paper.get("doi", ""),
                "cited_by_count": paper.get("cited_by_count", 0),
                "ranking_score": round(paper.get("ranking_score", 0), 3),
                "subfields": paper.get("subfields", []),
                "open_access": paper.get("open_access", False),
                "concepts_count": paper.get("concepts_count", 0),
                "referenced_works_count": paper.get("referenced_works_count", 0)
            })
        
        result = {
            "recommendations": recommendations,
            "total": len(recommendations),
            "algorithm": {
                "alpha": alpha,
                "beta": beta
            },
            "subfields": selected_subfields,
            "message": f"Found {len(filtered_papers)} papers, returning top {len(recommendations)}",
            "cached": False,
            "response_time": round((time.time() - start_time) * 1000, 2)
        }
        
        # Cache the result
        if redis_client:
            redis_client.setex(cache_key_val, CACHE_TTL, json.dumps(result))
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in get_recommendations: {e}")
        return jsonify({"error": str(e)}), 500

def get_filtered_papers_optimized(db, subfields, limit=1000):
    """Optimized paper filtering with proper indexing"""
    try:
        # Use aggregation pipeline for better performance
        pipeline = [
            {"$match": {"subfields": {"$in": subfields}}},
            {"$sort": {"cited_by_count": -1, "publication_date": -1}},
            {"$limit": limit},
            {"$project": {
                "_id": 1,
                "title": 1,
                "abstract": 1,
                "authors": 1,
                "institutions": 1,
                "publication_date": 1,
                "journal": 1,
                "doi": 1,
                "cited_by_count": 1,
                "subfields": 1,
                "open_access": 1,
                "concepts_count": 1,
                "referenced_works_count": 1
            }}
        ]
        
        return list(db[COLLECTION_NAME].aggregate(pipeline))
    except Exception as e:
        logger.error(f"Error in get_filtered_papers_optimized: {e}")
        return []

def calculate_ranks_optimized(papers, alpha, beta):
    """Optimized ranking calculation"""
    if not papers:
        return []
    
    # Pre-calculate max values
    max_citations = max(p.get("cited_by_count", 0) for p in papers)
    
    # Find oldest publication date for recency normalization
    valid_dates = [
        datetime.strptime(p["publication_date"], "%Y-%m-%d") 
        for p in papers 
        if p.get("publication_date")
    ]
    
    if not valid_dates:
        return papers
    
    oldest_date = min(valid_dates)
    max_days_since_pub = (datetime.utcnow() - oldest_date).days
    
    # Calculate scores efficiently
    for paper in papers:
        # Recency normalization (Rnorm)
        try:
            pub_date = datetime.strptime(paper.get("publication_date"), "%Y-%m-%d")
            days_since_pub = (datetime.utcnow() - pub_date).days
            Rnorm = days_since_pub / max_days_since_pub if max_days_since_pub > 0 else 0
        except (ValueError, TypeError):
            Rnorm = 0

        # Citation normalization (Cnorm)
        citations = paper.get("cited_by_count", 0)
        Cnorm = citations / max_citations if max_citations > 0 else 0

        # Calculate ranking score
        ranking_score = (1 - alpha * Rnorm) + (beta * Cnorm)
        paper["ranking_score"] = ranking_score

    # Sort by ranking score (higher is better)
    papers.sort(key=lambda p: p.get("ranking_score", 0), reverse=True)
    return papers

@app.route('/api/paper/<paper_id>', methods=['GET'])
@limiter.limit("100 per minute")
@cached(ttl=1800)  # Cache for 30 minutes
def get_paper_details(paper_id):
    """Get detailed information about a specific paper"""
    try:
        db = get_db()
        
        # Find paper by ID
        paper = db[COLLECTION_NAME].find_one({"_id": paper_id})
        
        if not paper:
            return jsonify({"error": "Paper not found"}), 404
        
        # Format detailed paper information
        paper_details = {
            "id": str(paper.get("_id", "")),
            "title": paper.get("title", "No title"),
            "abstract": paper.get("abstract", ""),
            "authors": paper.get("authors", []),
            "institutions": paper.get("institutions", []),
            "publication_date": paper.get("publication_date", ""),
            "journal": paper.get("journal", ""),
            "doi": paper.get("doi", ""),
            "cited_by_count": paper.get("cited_by_count", 0),
            "ranking_score": round(paper.get("relevance_score", 0), 3),
            "subfields": paper.get("subfields", []),
            "open_access": paper.get("open_access", False),
            "concepts_count": paper.get("concepts_count", 0),
            "referenced_works_count": paper.get("referenced_works_count", 0),
            "keywords": paper.get("keywords", []),
            "mesh_terms": paper.get("mesh_terms", []),
            "created_at": paper.get("created_at", "").isoformat() if paper.get("created_at") else None
        }
        
        return jsonify(paper_details)
        
    except Exception as e:
        logger.error(f"Error in get_paper_details: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
@limiter.limit("10 per minute")
@cached(ttl=3600)  # Cache for 1 hour
def get_stats():
    """Get database statistics"""
    try:
        db = get_db()
        
        # Get basic stats
        total_papers = db[COLLECTION_NAME].count_documents({})
        
        # Get papers by year
        pipeline = [
            {"$group": {"_id": "$publication_year", "count": {"$sum": 1}}},
            {"$sort": {"_id": -1}}
        ]
        papers_by_year = list(db[COLLECTION_NAME].aggregate(pipeline))
        
        # Get top journals
        journal_pipeline = [
            {"$group": {"_id": "$journal", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_journals = list(db[COLLECTION_NAME].aggregate(journal_pipeline))
        
        return jsonify({
            "total_papers": total_papers,
            "papers_by_year": papers_by_year,
            "top_journals": top_journals,
            "database": MONGO_DB,
            "collection": COLLECTION_NAME
        })
        
    except Exception as e:
        logger.error(f"Error in get_stats: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cache/clear', methods=['POST'])
@limiter.limit("5 per minute")
def clear_cache():
    """Clear all cache (admin endpoint)"""
    try:
        if redis_client:
            redis_client.flushdb()
            return jsonify({"message": "Cache cleared successfully"})
        else:
            return jsonify({"message": "No cache configured"})
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get system metrics"""
    try:
        metrics = {
            "timestamp": datetime.now().isoformat(),
            "health": health_check(),
            "cache_stats": {}
        }
        
        if redis_client:
            info = redis_client.info()
            metrics["cache_stats"] = {
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0)
            }
        
        return jsonify(metrics)
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return jsonify({"error": str(e)}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    """Rate limit exceeded handler"""
    return jsonify({
        "error": "Rate limit exceeded",
        "message": "Too many requests. Please try again later."
    }), 429

@app.errorhandler(500)
def internal_error(e):
    """Internal server error handler"""
    logger.error(f"Internal server error: {e}")
    return jsonify({
        "error": "Internal server error",
        "message": "Something went wrong. Please try again later."
    }), 500

def create_indexes():
    """Create database indexes for optimal performance"""
    try:
        db = get_db()
        collection = db[COLLECTION_NAME]
        
        # Create indexes for common queries
        collection.create_index([("subfields", 1)])
        collection.create_index([("cited_by_count", -1)])
        collection.create_index([("publication_date", -1)])
        collection.create_index([("journal", 1)])
        collection.create_index([("subfields", 1), ("cited_by_count", -1)])
        collection.create_index([("subfields", 1), ("publication_date", -1)])
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

if __name__ == '__main__':
    print("Starting Verge API Server (Scalable Edition)...")
    
    # Initialize connections
    init_connections()
    
    # Create database indexes
    create_indexes()
    
    print("Endpoints:")
    print("   GET  /api/health - Health check")
    print("   GET  /api/subfields - Get available subfields")
    print("   POST /api/recommend - Get recommendations")
    print("   GET  /api/paper/<id> - Get paper details")
    print("   GET  /api/stats - Get database statistics")
    print("   GET  /api/metrics - Get system metrics")
    print("   POST /api/cache/clear - Clear cache (admin)")
    print("Server running on http://localhost:5001")
    
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True) 