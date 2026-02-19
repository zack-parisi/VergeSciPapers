"""
MongoDB Vector Search Client
Handles connection and vector search operations for Eureka
"""
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from config import Config


class MongoVectorClient:
    """MongoDB client with vector search capabilities"""
    
    def __init__(self):
        """Initialize MongoDB connection"""
        self.client: Optional[MongoClient] = None
        self.db: Optional[Database] = None
        self.collection: Optional[Collection] = None
        self._connect()
    
    def _connect(self):
        """Establish MongoDB connection"""
        try:
            self.client = MongoClient(Config.MONGODB_URI)
            self.db = self.client[Config.MONGODB_DATABASE]
            self.collection = self.db[Config.MONGODB_COLLECTION]
            
            # Verify connection
            self.client.admin.command('ping')
            print(f"Connected to MongoDB: {Config.MONGODB_DATABASE}.{Config.MONGODB_COLLECTION}")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to MongoDB: {e}")
    
    def vector_search(
        self,
        query_vector: List[float],
        num_candidates: int = None,
        limit: int = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform vector similarity search using MongoDB Atlas $vectorSearch
        
        Args:
            query_vector: 1536-dimensional embedding vector
            num_candidates: Number of candidates to consider (default from config)
            limit: Number of results to return (default from config)
            filters: Optional pre-filters (e.g., {"journal": "Nature"})
        
        Returns:
            List of matching documents with similarity scores
        """
        num_candidates = num_candidates or Config.DEFAULT_NUM_CANDIDATES
        limit = limit or Config.DEFAULT_LIMIT
        
        # Build vector search pipeline with optional pre-filtering
        vector_search_stage = {
            "index": Config.VECTOR_INDEX_NAME,
            "path": "vector",
            "queryVector": query_vector,
            "numCandidates": num_candidates,
            "limit": limit
        }
        
        # Use MongoDB Atlas pre-filtering (filter parameter in $vectorSearch)
        # This filters BEFORE semantic ranking, which is crucial for date/journal filters
        if filters:
            vector_search_stage["filter"] = filters
        
        pipeline = [
            {"$vectorSearch": vector_search_stage},
            {
                "$project": {
                    "_id": 1,
                    "title": 1,
                    "abstract": 1,
                    "authors_string": 1,
                    "journal": 1,
                    "publication_date": 1,
                    "doi": 1,
                    "work_id": 1,
                    "subfields": 1,
                    "cited_by_count": 1,
                    "keywords": 1,
                    "open_access": 1,
                    "relevance_score": 1,
                    "score": {"$meta": "vectorSearchScore"}
                }
            }
        ]
        
        try:
            results = list(self.collection.aggregate(pipeline))
            print(f"Retrieved {len(results)} papers (candidates: {num_candidates}, limit: {limit})")
            return results
        except Exception as e:
            raise RuntimeError(f"Vector search failed: {e}")
    
    def get_paper_by_id(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific paper by _id or work_id"""
        result = self.collection.find_one({"$or": [{"_id": paper_id}, {"work_id": paper_id}]})
        return result
    
    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            print("MongoDB connection closed")


def format_paper_citation(paper: Dict[str, Any]) -> str:
    """
    Format a paper document into a citation-ready string
    
    Returns formatted citation with all relevant metadata
    """
    title = paper.get("title", "Untitled")
    authors = paper.get("authors_string", "Unknown authors")
    journal = paper.get("journal", "Unknown journal")
    date = paper.get("publication_date", "Unknown date")
    doi = paper.get("doi", "")
    work_id = paper.get("work_id", "")
    abstract = paper.get("abstract", "")
    subfields = paper.get("subfields", [])
    cited_by = paper.get("cited_by_count", 0)
    score = paper.get("score", 0.0)
    
    # Build citation
    citation = f"""
**Title**: {title}
**Authors**: {authors}
**Journal**: {journal} ({date})
**Citations**: {cited_by}
**Subfields**: {', '.join(subfields[:5]) if subfields else 'N/A'}
**Similarity Score**: {score:.4f}
**DOI**: {doi if doi else 'N/A'}
**OpenAlex**: {work_id}

**Abstract Excerpt**:
{abstract[:500]}{'...' if len(abstract) > 500 else ''}
""".strip()
    
    return citation


def format_context_for_llm(papers: List[Dict[str, Any]]) -> str:
    """
    Format retrieved papers into structured context for LLM consumption
    
    Returns a formatted string with all paper details for RAG
    """
    if not papers:
        return "No relevant papers found in the VergeSci database."
    
    context_parts = [
        "RETRIEVED CONTEXT FROM VERGESCI DATABASE",
        "=" * 80,
        f"\nTotal papers retrieved: {len(papers)}\n"
    ]
    
    for idx, paper in enumerate(papers, 1):
        context_parts.append(f"\n[PAPER {idx}]")
        context_parts.append(format_paper_citation(paper))
        context_parts.append("-" * 80)
    
    return "\n".join(context_parts)

