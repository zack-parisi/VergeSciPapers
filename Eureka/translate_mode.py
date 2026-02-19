"""
Translate Mode for Eureka
Two-node pipeline: Preprocessor → Vector Search → Presenter
Cross-subfield translation with terminology bridges
"""

import json
from openai import OpenAI
from mongo_client import MongoVectorClient
from embeddings import EmbeddingGenerator
from config import Config
from translate_prompts import (
    get_translate_preprocessor_prompt,
    get_translate_presenter_prompt
)


class TranslateMode:
    """
    Translate Mode: Cross-subfield translation with terminology bridges
    Two-node pipeline: Preprocessor → Presenter
    Uses 30 candidates and returns 12 final results
    """
    
    def __init__(self):
        """Initialize Translate Mode components"""
        self.embedding_generator = EmbeddingGenerator()
        self.mongo_client = MongoVectorClient()
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def close(self):
        """Close MongoDB connection"""
        self.mongo_client.close()
    
    def _preprocess_query(self, user_query: str, verbose: bool = False) -> dict:
        """
        Node 1: Preprocessor
        Converts user query into a structured Translation Query Plan
        
        Args:
            user_query: Raw user input
            verbose: Print debug info
            
        Returns:
            dict: Translation query plan JSON
        """
        if verbose:
            print("[Preprocessor] Analyzing translation query...")
        
        prompt = get_translate_preprocessor_prompt(user_query)
        
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
            print(f"[Preprocessor] Translation query plan generated")
            if query_plan.get("ClarificationsNeeded"):
                print(f"     Clarifications needed: {query_plan['ClarificationsNeeded']}")
        
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
        
        if verbose and filters:
            print(f"     Filters: {filters}")
        
        return filters if filters else None
    
    def search(
        self,
        user_query: str,
        num_candidates: int = 30,
        limit: int = 12,
        verbose: bool = False
    ) -> dict:
        """
        Execute Translate Mode: Preprocessor → RAG → Presenter
        
        Args:
            user_query: User's translation query
            num_candidates: Number of candidates for vector search (default: 30)
            limit: Number of final results (default: 12)
            verbose: Print debug information
            
        Returns:
            dict: Translation with structured cross-subfield bridges
        """
        if verbose:
            print("\n" + "="*80)
            print("EUREKA TRANSLATE MODE")
            print("="*80)
            print(f"\nQuery: {user_query}\n")
        
        # Stage 1: Preprocess query
        if verbose:
            print("[Stage 1/3] Query Preprocessing")
        
        query_plan = self._preprocess_query(user_query, verbose)
        
        if verbose:
            print("\n" + "-"*80)
            print("TRANSLATION QUERY PLAN (Preprocessor Output):")
            print("-"*80)
            print(json.dumps(query_plan, indent=2))
            print("-"*80)
            print()
        
        # Stage 2: Vector search with filters
        if verbose:
            print(f"[Stage 2/3] Cross-Subfield Vector Search")
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
        
        # Perform vector search
        papers = self.mongo_client.vector_search(
            query_vector=query_embedding,
            num_candidates=num_candidates,
            limit=limit,
            filters=filters
        )
        
        if verbose:
            print(f"Retrieved {len(papers)} papers (candidates: {num_candidates}, limit: {limit})")
            print(f"     Retrieved {len(papers)} papers")
        
        # Stage 3: Generate translation
        if verbose:
            print(f"[Stage 3/3] Cross-Subfield Translation Generation")
            print(f"     Generating structured translation...")
        
        result = self._present_translation(user_query, query_plan, papers, verbose)
        
        if verbose:
            print("\n" + "="*80)
            print("TRANSLATION")
            print("="*80)
            print(result.get("translation", "No translation generated"))
            print("\n" + "="*80)
        
        return result
    
    def _present_translation(
        self,
        user_query: str,
        query_plan: dict,
        papers: list,
        verbose: bool = False
    ) -> dict:
        """
        Node 2: Presenter
        Generates structured cross-subfield translation
        
        Args:
            user_query: Original user query
            query_plan: Query plan from preprocessor
            papers: Retrieved papers
            verbose: Print debug info
            
        Returns:
            dict: Structured translation with bridges
        """
        if not papers:
            return {
                "query": user_query,
                "translation": "Insufficient evidence: No relevant cross-subfield papers found in the database.",
                "papers": [],
                "clarifications": query_plan.get("ClarificationsNeeded", [])
            }
        
        # Use LLM to generate structured translation
        prompt = get_translate_presenter_prompt(user_query, query_plan, papers)
        
        # Build completion parameters
        completion_params = {
            "model": Config.GPT_MODEL,
            "messages": [
                {"role": "system", "content": prompt}
            ]
        }
        
        # GPT-5 Nano uses defaults - doesn't support custom temperature
        if "gpt-5" not in Config.GPT_MODEL.lower():
            completion_params["temperature"] = 0.1
            completion_params["max_tokens"] = 2000
        
        response = self.openai_client.chat.completions.create(**completion_params)
        
        translation_text = response.choices[0].message.content
        
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
            "translation": translation_text,
            "papers": formatted_papers,
            "clarifications": query_plan.get("ClarificationsNeeded", []),
            "metadata": {
                "num_papers": len(papers),
                "mode": "translate",
                "home_subfield": query_plan.get("HomeSubfieldOrContext", {}).get("name"),
                "target_subjects": query_plan.get("TargetSubjects", [])
            }
        }

