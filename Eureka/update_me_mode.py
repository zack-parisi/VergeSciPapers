"""
Update Me Mode for Eureka
Two-node pipeline: Preprocessor → Vector Search → Presenter
Time-bounded updates (last 12 months) with engaging digest format
"""

import json
from datetime import datetime, timedelta
from openai import OpenAI
from mongo_client import MongoVectorClient
from embeddings import EmbeddingGenerator
from config import Config
from update_me_prompts import (
    get_update_me_preprocessor_prompt,
    get_update_me_presenter_prompt
)


class UpdateMeMode:
    """
    Update Me Mode: Recent neuroscience updates (last 12 months)
    Two-node pipeline: Preprocessor → Presenter
    Uses 40 candidates and returns 12 final results
    """
    
    def __init__(self):
        """Initialize Update Me Mode components"""
        self.embedding_generator = EmbeddingGenerator()
        self.mongo_client = MongoVectorClient()
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def close(self):
        """Close MongoDB connection"""
        self.mongo_client.close()
    
    def _preprocess_query(self, user_query: str, verbose: bool = False) -> dict:
        """
        Node 1: Preprocessor
        Converts user query into a structured Update Query Plan
        
        Args:
            user_query: Raw user input
            verbose: Print debug info
            
        Returns:
            dict: Update query plan JSON
        """
        if verbose:
            print("[Preprocessor] Analyzing update query...")
        
        prompt = get_update_me_preprocessor_prompt(user_query)
        
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
            print(f"[Preprocessor] Update query plan generated")
            if query_plan.get("ClarificationsNeeded"):
                print(f"     Clarifications needed: {query_plan['ClarificationsNeeded']}")
        
        return query_plan
    
    def _build_filters_from_plan(self, query_plan: dict, verbose: bool = False) -> dict | None:
        """
        Builds MongoDB filters from the query plan
        ALWAYS includes 12-month recency constraint
        
        Args:
            query_plan: The preprocessor output
            verbose: Print debug info
            
        Returns:
            dict: MongoDB filters (always includes temporal constraint)
        """
        filters = {}
        
        # ALWAYS apply 12-month recency constraint
        today = datetime.now()
        one_year_ago = today - timedelta(days=365)
        
        filters["publication_date"] = {
            "$gte": one_year_ago.strftime("%Y-%m-%d"),
            "$lte": today.strftime("%Y-%m-%d")
        }
        
        if verbose:
            print(f"     Time constraint: {one_year_ago.strftime('%Y-%m-%d')} to {today.strftime('%Y-%m-%d')}")
        
        # Additional constraints from query plan
        constraints = query_plan.get("Constraints", {})
        
        # Journal/venue constraints
        venues = constraints.get("VenuesOrSources", [])
        if venues:
            filters["journal"] = {"$in": venues}
        
        if verbose and filters:
            print(f"     Filters: {filters}")
        
        return filters
    
    def search(
        self,
        user_query: str,
        num_candidates: int = 40,
        limit: int = 12,
        verbose: bool = False
    ) -> dict:
        """
        Execute Update Me Mode: Preprocessor → RAG → Presenter
        
        Args:
            user_query: User's update request
            num_candidates: Number of candidates for vector search (default: 40)
            limit: Number of final results (default: 12)
            verbose: Print debug information
            
        Returns:
            dict: Update digest with recent papers (≤ 12 months)
        """
        if verbose:
            print("\n" + "="*80)
            print("EUREKA UPDATE ME MODE")
            print("="*80)
            print(f"\nQuery: {user_query}\n")
        
        # Stage 1: Preprocess query
        if verbose:
            print("[Stage 1/3] Query Preprocessing")
        
        query_plan = self._preprocess_query(user_query, verbose)
        
        if verbose:
            print("\n" + "-"*80)
            print("UPDATE QUERY PLAN (Preprocessor Output):")
            print("-"*80)
            print(json.dumps(query_plan, indent=2))
            print("-"*80)
            print()
        
        # Stage 2: Vector search with 12-month filter
        if verbose:
            print(f"[Stage 2/3] Recent Papers Vector Search")
            print(f"     Using {num_candidates} candidates")
        
        # Build filters from query plan (always includes 12-month constraint)
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
        
        # Perform vector search with recency filter
        papers = self.mongo_client.vector_search(
            query_vector=query_embedding,
            num_candidates=num_candidates,
            limit=limit,
            filters=filters
        )
        
        if verbose:
            print(f"Retrieved {len(papers)} recent papers (candidates: {num_candidates}, limit: {limit})")
            print(f"     Retrieved {len(papers)} papers from last 12 months")
        
        # Stage 3: Generate update digest
        if verbose:
            print(f"[Stage 3/3] Update Digest Generation")
            print(f"     Generating engaging update digest...")
        
        result = self._present_update_digest(user_query, query_plan, papers, verbose)
        
        if verbose:
            print("\n" + "="*80)
            print("UPDATE DIGEST")
            print("="*80)
            print(result.get("digest", "No digest generated"))
            print("\n" + "="*80)
        
        return result
    
    def _present_update_digest(
        self,
        user_query: str,
        query_plan: dict,
        papers: list,
        verbose: bool = False
    ) -> dict:
        """
        Node 2: Presenter
        Generates engaging update digest from recent papers
        Optimized: Skips LLM presenter, formats directly from papers
        
        Args:
            user_query: Original user query
            query_plan: Query plan from preprocessor
            papers: Retrieved papers (all ≤ 12 months old)
            verbose: Print debug info
            
        Returns:
            dict: Update digest with structured format
        """
        if not papers:
            return {
                "query": user_query,
                "digest": "No verified studies within the past year match this query. Consider broadening your focus or adjusting search terms.",
                "papers": [],
                "clarifications": query_plan.get("ClarificationsNeeded", []),
                "metadata": {
                    "mode": "update",
                    "time_range": "last 12 months",
                    "papers_found": 0
                }
            }
        
        # Generate headline summary using LLM (optimized - only summarize, no full digest)
        # Build a concise prompt for just the headline summary
        papers_summary = []
        for i, paper in enumerate(papers[:5], 1):  # Only first 5 for headline context
            abstract = paper.get('abstract', '')
            excerpt = abstract[:150] + "..." if len(abstract) > 150 else abstract
            papers_summary.append(f"Paper {i}: {paper.get('title')} - {excerpt}")
        
        headline_prompt = f"""You are generating a headline summary for recent neuroscience research.

USER QUERY: {user_query}

RECENT PAPERS (Last 12 months):
{chr(10).join(papers_summary)}

Generate a 3-4 sentence headline summary of the main developments in this area over the past year.
Use ONLY information from the papers provided. Be engaging but accurate. Include specific findings.
Do not hallucinate or add information not present in the papers.
"""
        
        # Build completion parameters
        completion_params = {
            "model": Config.GPT_MODEL,
            "messages": [
                {"role": "system", "content": headline_prompt}
            ]
        }
        
        # GPT-5 Nano uses defaults - doesn't support custom temperature
        if "gpt-5" not in Config.GPT_MODEL.lower():
            completion_params["temperature"] = 0.1
            completion_params["max_tokens"] = 300
        
        response = self.openai_client.chat.completions.create(**completion_params)
        
        digest_text = response.choices[0].message.content
        
        # Format papers for frontend
        formatted_papers = []
        for paper in papers:
            # Convert authors_string to array format
            authors_string = paper.get("authors_string", "")
            authors_array = authors_string.split("|") if authors_string else []
            
            # Get publication date
            publication_date = paper.get("publication_date")
            if not publication_date and paper.get("year"):
                publication_date = f"{paper.get('year')}-01-01"
            
            formatted_papers.append({
                "title": paper.get("title"),
                "authors": authors_array,
                "year": publication_date,
                "journal": paper.get("journal"),
                "doi": paper.get("doi"),
                "work_id": paper.get("work_id"),
                "abstract": paper.get("abstract"),
                "cited_by_count": paper.get("cited_by_count"),
                "subfields": paper.get("subfields", []),
                "keywords": paper.get("keywords", []),
                "open_access": paper.get("open_access", False)
            })
        
        return {
            "query": user_query,
            "digest": digest_text,
            "papers": formatted_papers,
            "clarifications": query_plan.get("ClarificationsNeeded", []),
            "metadata": {
                "mode": "update",
                "num_papers": len(papers),
                "time_range": "last 12 months",
                "core_topics": query_plan.get("CoreTopics", []),
                "subfields": query_plan.get("Subfields", [])
            }
        }

