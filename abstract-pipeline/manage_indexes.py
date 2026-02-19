#!/usr/bin/env python3
"""
Database Management and Optimization Script for Verge Pipeline
Handles indexing, performance analysis, and scaling recommendations
"""

import pymongo
import json
import os
from datetime import datetime
from dotenv import load_dotenv
import time
from collections import defaultdict

load_dotenv()

# Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit"
COLLECTION_NAME = "papers_clean"

class DatabaseOptimizer:
    def __init__(self):
        self.client = pymongo.MongoClient(
            MONGO_URI,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000
        )
        self.db = self.client[MONGO_DB]
        self.collection = self.db[COLLECTION_NAME]
    
    def create_indexes(self):
        """Create optimized indexes for common queries"""
        print("Creating database indexes...")
        
        indexes = [
            # Basic indexes
            [("subfields", 1)],
            [("cited_by_count", -1)],
            [("publication_date", -1)],
            [("journal", 1)],
            [("authors", 1)],
            [("doi", 1)],
            
            # Compound indexes for common query patterns
            [("subfields", 1), ("cited_by_count", -1)],
            [("subfields", 1), ("publication_date", -1)],
            [("subfields", 1), ("cited_by_count", -1), ("publication_date", -1)],
            [("journal", 1), ("cited_by_count", -1)],
            [("publication_date", -1), ("cited_by_count", -1)],
            
            # Text search indexes
            [("title", "text"), ("abstract", "text")],
            
            # Geospatial indexes (if location data exists)
            # [("institution_location", "2dsphere")],
        ]
        
        created_count = 0
        for index in indexes:
            try:
                index_name = "_".join([f"{field}_{direction}" for field, direction in index])
                self.collection.create_index(index)
                print(f"Created index: {index_name}")
                created_count += 1
            except Exception as e:
                print(f"Index creation failed for {index}: {e}")
        
        print(f"Created {created_count} indexes successfully")
        return created_count
    
    def analyze_performance(self):
        """Analyze database performance and provide recommendations"""
        print("\nAnalyzing database performance...")
        
        # Get collection stats
        stats = self.db.command("collstats", COLLECTION_NAME)
        
        # Get index usage
        index_stats = self.db.command("indexStats", COLLECTION_NAME)
        
        # Analyze query patterns
        query_analysis = self.analyze_query_patterns()
        
        # Performance metrics
        performance_metrics = {
            "collection_size_mb": round(stats.get("size", 0) / (1024 * 1024), 2),
            "index_size_mb": round(stats.get("totalIndexSize", 0) / (1024 * 1024), 2),
            "document_count": stats.get("count", 0),
            "avg_document_size": round(stats.get("avgObjSize", 0), 2),
            "storage_size_mb": round(stats.get("storageSize", 0) / (1024 * 1024), 2),
            "index_count": len(stats.get("indexSizes", {})),
            "query_analysis": query_analysis
        }
        
        return performance_metrics
    
    def analyze_query_patterns(self):
        """Analyze common query patterns for optimization"""
        print("Analyzing query patterns...")
        
        # Sample queries to test performance
        test_queries = [
            {
                "name": "Subfield filtering",
                "query": {"subfields": {"$in": ["Neuroscience"]}},
                "limit": 100
            },
            {
                "name": "High citation papers",
                "query": {"cited_by_count": {"$gte": 100}},
                "limit": 100
            },
            {
                "name": "Recent papers",
                "query": {"publication_date": {"$gte": "2023-01-01"}},
                "limit": 100
            },
            {
                "name": "Subfield + citations",
                "query": {
                    "subfields": {"$in": ["Neuroscience"]},
                    "cited_by_count": {"$gte": 50}
                },
                "limit": 100
            }
        ]
        
        query_results = {}
        
        for test_query in test_queries:
            start_time = time.time()
            
            # Execute query with explain
            cursor = self.collection.find(test_query["query"]).limit(test_query["limit"])
            results = list(cursor)
            
            execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            # Get query plan
            explain_result = self.collection.find(test_query["query"]).limit(test_query["limit"]).explain()
            
            query_results[test_query["name"]] = {
                "execution_time_ms": round(execution_time, 2),
                "result_count": len(results),
                "query_plan": explain_result.get("queryPlanner", {}),
                "index_used": explain_result.get("queryPlanner", {}).get("winningPlan", {}).get("inputStage", {}).get("indexName", "COLLSCAN")
            }
        
        return query_results
    
    def get_scaling_recommendations(self, performance_metrics):
        """Provide scaling recommendations based on performance analysis"""
        print("\nGenerating scaling recommendations...")
        
        recommendations = []
        
        # Analyze collection size
        collection_size = performance_metrics["collection_size_mb"]
        if collection_size > 1000:  # 1GB
            recommendations.append({
                "type": "storage",
                "priority": "high",
                "message": f"Collection size is {collection_size}MB. Consider sharding for collections > 1GB.",
                "action": "Implement MongoDB sharding across multiple nodes"
            })
        
        # Analyze index usage
        query_analysis = performance_metrics.get("query_analysis", {})
        for query_name, query_data in query_analysis.items():
            if query_data["index_used"] == "COLLSCAN":
                recommendations.append({
                    "type": "indexing",
                    "priority": "high",
                    "message": f"Query '{query_name}' is using collection scan. Consider adding appropriate index.",
                    "action": "Create compound index for the query pattern"
                })
            
            if query_data["execution_time_ms"] > 100:
                recommendations.append({
                    "type": "performance",
                    "priority": "medium",
                    "message": f"Query '{query_name}' takes {query_data['execution_time_ms']}ms. Consider optimization.",
                    "action": "Review query pattern and add indexes"
                })
        
        # Memory recommendations
        index_size = performance_metrics["index_size_mb"]
        if index_size > 500:  # 500MB
            recommendations.append({
                "type": "memory",
                "priority": "medium",
                "message": f"Index size is {index_size}MB. Consider index optimization.",
                "action": "Review and remove unused indexes"
            })
        
        # Connection pool recommendations
        recommendations.append({
            "type": "connection",
            "priority": "low",
            "message": "Ensure connection pooling is configured properly.",
            "action": "Set maxPoolSize=50, minPoolSize=10 for production"
        })
        
        return recommendations
    
    def optimize_collection(self):
        """Perform collection optimization tasks"""
        print("\nOptimizing collection...")
        
        # Compact collection to reclaim space
        try:
            self.db.command("compact", COLLECTION_NAME)
            print("Collection compacted successfully")
        except Exception as e:
            print(f"Collection compaction failed: {e}")
        
        # Update statistics
        try:
            self.db.command("collMod", COLLECTION_NAME, validator={})
            print("Collection statistics updated")
        except Exception as e:
            print(f"Statistics update failed: {e}")
    
    def generate_report(self):
        """Generate comprehensive optimization report"""
        print("\nGenerating optimization report...")
        
        # Create indexes
        index_count = self.create_indexes()
        
        # Analyze performance
        performance_metrics = self.analyze_performance()
        
        # Get recommendations
        recommendations = self.get_scaling_recommendations(performance_metrics)
        
        # Generate report
        report = {
            "timestamp": datetime.now().isoformat(),
            "database": MONGO_DB,
            "collection": COLLECTION_NAME,
            "indexes_created": index_count,
            "performance_metrics": performance_metrics,
            "recommendations": recommendations,
            "scaling_tier": self.determine_scaling_tier(performance_metrics)
        }
        
        # Save report
        with open("database_optimization_report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        # Print summary
        self.print_summary(report)
        
        return report
    
    def determine_scaling_tier(self, performance_metrics):
        """Determine the appropriate scaling tier based on metrics"""
        collection_size = performance_metrics["collection_size_mb"]
        document_count = performance_metrics["document_count"]
        
        if collection_size < 100 and document_count < 10000:
            return "development"
        elif collection_size < 1000 and document_count < 100000:
            return "small_production"
        elif collection_size < 10000 and document_count < 1000000:
            return "medium_production"
        else:
            return "large_production"
    
    def print_summary(self, report):
        """Print a human-readable summary of the optimization report"""
        print("\n" + "="*60)
        print("DATABASE OPTIMIZATION SUMMARY")
        print("="*60)
        
        metrics = report["performance_metrics"]
        print(f"Collection Size: {metrics['collection_size_mb']} MB")
        print(f"Document Count: {metrics['document_count']:,}")
        print(f"Index Count: {metrics['index_count']}")
        print(f"Scaling Tier: {report['scaling_tier']}")
        
        print(f"\nQuery Performance:")
        for query_name, query_data in metrics.get("query_analysis", {}).items():
            print(f"   {query_name}: {query_data['execution_time_ms']}ms ({query_data['index_used']})")
        
        print(f"\nRecommendations ({len(report['recommendations'])}):")
        for i, rec in enumerate(report['recommendations'], 1):
            priority_emoji = rec["priority"].upper()
            print(f"   {i}. {priority_emoji} {rec['message']}")
        
        print(f"\nFull report saved to: database_optimization_report.json")
        print("="*60)
    
    def close(self):
        """Close database connection"""
        if self.client:
            self.client.close()

def main():
    """Main function"""
    print("Verge Pipeline Database Optimizer")
    print("="*50)
    
    optimizer = DatabaseOptimizer()
    
    try:
        # Test connection
        optimizer.db.command("ping")
        print("Connected to MongoDB successfully")
        
        # Generate optimization report
        report = optimizer.generate_report()
        
        # Optimize collection
        optimizer.optimize_collection()
        
        print("\nDatabase optimization completed successfully!")
        
    except Exception as e:
        print(f"Error during optimization: {e}")
    finally:
        optimizer.close()

if __name__ == "__main__":
    main()
