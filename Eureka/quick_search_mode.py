"""
Quick Search Mode for Eureka
Two-node pipeline optimized for speed and top-10 paper discovery
"""

import json
import os
from openai import OpenAI
from mongo_client import MongoVectorClient
from embeddings import EmbeddingGenerator
from config import Config
from quick_search_prompts import (
    get_quicksearch_preprocessor_prompt,
    get_quicksearch_presenter_prompt
)


class QuickSearchMode:
    """
    Quick Search Mode: Fast top-10 paper discovery
    Two-node pipeline: Preprocessor → Presenter
    """
    
    def __init__(self):
        """Initialize Quick Search Mode components"""
        self.embedding_generator = EmbeddingGenerator()
        self.mongo_client = MongoVectorClient()
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def close(self):
        """Close MongoDB connection"""
        self.mongo_client.close()
    
    def _preprocess_query(self, user_query: str, verbose: bool = False) -> dict:
        """
        Node 1: Preprocessor
        Converts user query into a structured RAG query plan
        
        Args:
            user_query: Raw user input
            verbose: Print debug info
            
        Returns:
            dict: Query plan JSON
        """
        if verbose:
            print("[Preprocessor] Analyzing query...")
        
        prompt = get_quicksearch_preprocessor_prompt(user_query)
        
        # Build completion parameters
        completion_params = {
            "model": Config.GPT_MODEL,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_query}
            ],
            "response_format": {"type": "json_object"}
        }
        
        # GPT-5 Nano uses defaults - doesn't support custom temperature
        if "gpt-5" not in Config.GPT_MODEL.lower():
            completion_params["temperature"] = 0.0
        
        response = self.openai_client.chat.completions.create(**completion_params)
        
        query_plan = json.loads(response.choices[0].message.content)
        
        if verbose:
            print(f"[Preprocessor] Query plan generated")
            print(f"     Intent: {query_plan.get('Intent', 'N/A')}")
        
        return query_plan
    
    def _build_filters_from_plan(self, query_plan: dict, verbose: bool = False) -> dict | None:
        """
        Builds MongoDB filters from the query plan
        
        Args:
            query_plan: The preprocessor output
            verbose: Print debug info
            
        Returns:
            dict or None: MongoDB filters
        """
        filters = {}
        constraints = query_plan.get("Constraints", {})
        
        # Temporal constraints
        temporal = constraints.get("Temporal", {})
        if temporal.get("From") or temporal.get("To"):
            date_filter = {}
            if temporal.get("From"):
                date_filter["$gte"] = f"{temporal['From']}-01-01"
            if temporal.get("To"):
                date_filter["$lte"] = f"{temporal['To']}-12-31"
            if date_filter:
                filters["publication_date"] = date_filter
        
        # Journal/venue constraints
        venues = constraints.get("VenuesOrSources", [])
        if venues:
            filters["journal"] = {"$in": venues}
        
        # Author constraints - detect author queries for two-stage search
        original_query = query_plan.get("Intent", "").lower()
        entities = query_plan.get("EntitiesAndConcepts", {}).get("Primary", [])
        
        # Enhanced author detection
        author_keywords = ["by ", "written by", "authored by", "author", "papers by"]
        if any(keyword in original_query for keyword in author_keywords):
            # Try to extract full author name using regex patterns
            import re
            author_patterns = [
                r'([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)',  # "Clifford B. Saper"
                r'([A-Z][a-z]+\s+[A-Z][a-z]+)',                 # "Clifford Saper"
            ]
            
            author_found = False
            for pattern in author_patterns:
                match = re.search(pattern, query_plan.get("Intent", ""))
                if match:
                    author_name = match.group(1)
                    # Store author name for two-stage search
                    filters["_author_query"] = author_name
                    author_found = True
                    break
            
            # Fallback to entity-based detection if no regex match
            if not author_found:
                for entity in entities:
                    words = entity.split()
                    if len(words) <= 3 and all(word[0].isupper() if word else False for word in words):
                        if entity not in ["Attention", "Memory", "Perception"]:
                            filters["_author_query"] = entity
                            break
        
        if verbose and filters:
            print(f"     Filters: {filters}")
        
        return filters if filters else None
    
    def search(
        self,
        user_query: str,
        num_candidates: int = 30,
        limit: int = 10,
        verbose: bool = False
    ) -> dict:
        """
        Execute Quick Search: Preprocessor → RAG → Presenter
        
        Args:
            user_query: User's search query
            num_candidates: Number of candidates for vector search (default: 30)
            limit: Number of final results (default: 10)
            verbose: Print debug information
            
        Returns:
            dict: Results with top 10 papers and metadata
        """
        if verbose:
            print("\n" + "="*80)
            print("EUREKA QUICK SEARCH MODE")
            print("="*80)
            print(f"\nQuery: {user_query}\n")
        
        # Stage 1: Preprocess query
        if verbose:
            print("[Stage 1/3] Query Preprocessing")
        
        query_plan = self._preprocess_query(user_query, verbose)
        
        if verbose:
            print("\n" + "-"*80)
            print("QUERY PLAN (Preprocessor Output):")
            print("-"*80)
            print(json.dumps(query_plan, indent=2))
            print("-"*80)
            print()
        
        # Stage 2: Vector search with filters
        if verbose:
            print(f"[Stage 2/3] Vector Search")
            print(f"     Using {num_candidates} candidates")
        
        # Build filters from query plan
        filters = self._build_filters_from_plan(query_plan, verbose)
        
        # Generate embedding for the search text
        search_text = query_plan.get("Intent", user_query)
        if verbose:
            print(f"     Search text: '{search_text[:100]}...'")
        
        embedding_response = self.openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=search_text
        )
        query_embedding = embedding_response.data[0].embedding
        
        # Handle author queries with two-stage approach
        author_query = filters.pop("_author_query", None) if filters else None
        
        if author_query:
            # Two-stage approach: regex search + vector search within author papers
            import re
            author_name = author_query
            
            if verbose:
                print(f"     Stage 1: Finding papers by author '{author_name}'")
            
            # Stage 1: Use regex to find papers by the author
            query = {"authors_string": {"$regex": author_name, "$options": "i"}}
            author_papers = list(self.mongo_client.collection.find(query).limit(1000))
            
            if verbose:
                print(f"     Found {len(author_papers)} papers by '{author_name}'")
            
            if author_papers:
                # Stage 2: Manual vector search within author's papers
                if verbose:
                    print(f"     Stage 2: Vector search within author papers")
                
                import numpy as np
                
                # Calculate cosine similarity for each paper
                scored_papers = []
                for paper in author_papers:
                    if 'vector' in paper and paper['vector']:
                        paper_vector = np.array(paper['vector'])
                        query_vector = np.array(query_embedding)
                        
                        # Cosine similarity
                        similarity = np.dot(query_vector, paper_vector) / (
                            np.linalg.norm(query_vector) * np.linalg.norm(paper_vector)
                        )
                        
                        scored_papers.append({
                            'paper': paper,
                            'score': similarity
                        })
                
                # Sort by similarity and take top results
                scored_papers.sort(key=lambda x: x['score'], reverse=True)
                papers = [item['paper'] for item in scored_papers[:limit]]
                
                if verbose:
                    print(f"     Vector search within author papers: {len(papers)} results")
            else:
                papers = []
        else:
            # Standard vector search for non-author queries
            papers = self.mongo_client.vector_search(
                query_vector=query_embedding,
                num_candidates=num_candidates,
                limit=limit,
                filters=filters
            )
        
        if verbose:
            print(f"     Retrieved {len(papers)} papers")
        
        # Stage 3: Present results
        if verbose:
            print(f"[Stage 3/3] Result Presentation")
            print(f"     Generating top-{limit} results...")
        
        result = self._present_results(user_query, query_plan, papers, verbose)
        
        if verbose:
            print("\n" + "="*80)
            print("RESULTS")
            print("="*80)
            print(json.dumps(result, indent=2))
            print("\n" + "="*80)
        
        return result
    
    def _present_results(
        self,
        user_query: str,
        query_plan: dict,
        papers: list,
        verbose: bool = False
    ) -> dict:
        """
        Node 2: Presenter
        Formats top-10 results directly from vector search
        
        Args:
            user_query: Original user query
            query_plan: Query plan from preprocessor
            papers: Retrieved papers (already ranked by vector similarity)
            verbose: Print debug info
            
        Returns:
            dict: Formatted results
        """
        if not papers:
            return {
                "query": user_query,
                "results": [],
                "notes": ["No on-target documents found in current database. Consider refining terms."]
            }
        
        # Quick Search optimization: Skip LLM presenter, use vector similarity ranking directly
        # Papers are already ranked by semantic relevance from vector search
        results = []
        for rank, paper in enumerate(papers, 1):
            # Generate a simple relevance note from the abstract (first sentence)
            abstract = paper.get("abstract", "")
            relevance_note = ""
            if abstract:
                # Take first sentence as relevance note (up to 150 chars)
                first_sentence = abstract.split('.')[0] if '.' in abstract else abstract[:150]
                relevance_note = first_sentence[:150] + "..." if len(first_sentence) > 150 else first_sentence
            
            # Convert authors_string to array format for frontend compatibility
            authors_string = paper.get("authors_string", "")
            authors_array = authors_string.split("|") if authors_string else []
            
            # Get publication date - try publication_date field first, fallback to year
            publication_date = paper.get("publication_date")
            if not publication_date and paper.get("year"):
                # If only year is available, format as YYYY-MM-DD
                publication_date = f"{paper.get('year')}-01-01"
            
            results.append({
                "rank": rank,
                "title": paper.get("title"),
                "authors": authors_array,  # Convert from "Author1 | Author2" to ["Author1", "Author2"]
                "year": publication_date,  # Use publication_date field
                "journal": paper.get("journal"),
                "doi": paper.get("doi"),
                "work_id": paper.get("work_id"),
                "abstract": paper.get("abstract"),
                "cited_by_count": paper.get("cited_by_count"),
                "subfields": paper.get("subfields", []),
                "keywords": paper.get("keywords", []),
                "open_access": paper.get("open_access", False),
                "relevance_note": relevance_note,
                "verbatim_support": relevance_note,  # Use same as relevance note
                "confidence": "High"
            })
        
        return {
            "query": user_query,
            "results": results,
            "notes": [
                "Results ranked by semantic similarity to your query.",
                f"Showing top {len(results)} most relevant papers from the database."
            ]
        }

