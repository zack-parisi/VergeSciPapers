"""
Eureka Search Mode
Two-stage pipeline: Preprocessor → Vector Search → Grounded Answer
"""
from typing import Dict, Any
from openai import OpenAI
from config import Config
from embeddings import EmbeddingGenerator
from mongo_client import MongoVectorClient, format_context_for_llm
from prompts import SEARCH_MODE_SYSTEM_PROMPT, get_search_mode_user_prompt
from preprocessor import QueryPreprocessor


class SearchMode:
    """
    Search Mode: User Query → Preprocessor (JSON) → Vector Search → Grounded Answer
    
    Stage 1: Query preprocessor structures the query into a JSON plan
    Stage 2: Vector search retrieves relevant papers using the structured plan
    Stage 3: GPT-4 synthesizes a grounded answer with citations
    
    Zero hallucination tolerance. Every claim must be backed by retrieved papers.
    """
    
    def __init__(self):
        """Initialize Search Mode components"""
        self.preprocessor = QueryPreprocessor()
        self.embedding_generator = EmbeddingGenerator()
        self.mongo_client = MongoVectorClient()
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def search(
        self,
        query: str,
        num_candidates: int = None,
        limit: int = None,
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        Execute search mode pipeline with preprocessing
        
        Args:
            query: User's neuroscience question
            num_candidates: Number of candidates for vector search (auto-adjusted if filters present)
            limit: Number of papers to retrieve (default: 3)
            verbose: Print progress information
        
        Returns:
            Dictionary containing query, query_plan, retrieved_papers, answer, and metadata
        """
        if verbose:
            print(f"\n{'='*80}")
            print("EUREKA SEARCH MODE")
            print(f"{'='*80}")
            print(f"Query: {query}\n")
        
        # STAGE 1: Preprocess query into structured JSON plan
        if verbose:
            print("[Stage 1/3] Query Preprocessing")
        query_plan = self.preprocessor.preprocess(query, verbose=verbose)
        
        # Display query plan JSON for debugging
        if verbose:
            import json
            print(f"\n{'─'*80}")
            print("QUERY PLAN (Preprocessor Output):")
            print(f"{'─'*80}")
            print(json.dumps(query_plan, indent=2))
            print(f"{'─'*80}\n")
        
        # Extract search parameters from query plan
        limit = limit or Config.DEFAULT_LIMIT
        intent = query_plan.get("Intent", query)
        decomposition = query_plan.get("Decomposition", [])
        
        # Use first subquery if decomposed, otherwise use intent
        if decomposition:
            search_text = decomposition[0].get("subquery", intent)
        else:
            search_text = intent
        
        # Build MongoDB filters from constraints
        filters = self._build_filters_from_plan(query_plan)
        
        # Smart candidate calculation based on filters
        if filters and not num_candidates:
            num_candidates = min(limit * 100, 500)  # Deep search when filters present
            if verbose:
                print(f"     Using {num_candidates} candidates (filters detected)")
        elif not num_candidates:
            num_candidates = limit * 10  # Standard search
        
        # STAGE 2: Vector search with preprocessed query
        if verbose:
            print(f"\n[Stage 2/3] Vector Search")
            print(f"     Search text: '{search_text[:80]}...'")
            if filters:
                print(f"     Filters: {filters}")
        
        query_embedding = self.embedding_generator.generate_embedding(search_text)
        
        # Handle author queries with direct MongoDB search (like the working /search feature)
        author_query = filters.pop("_author_query", None) if filters else None
        
        if author_query:
            # Two-stage approach: regex search + vector search within author papers
            import re
            author_name = author_query
            
            if verbose:
                print(f"     Stage 1: Finding papers by author '{author_name}'")
            
            # Stage 1: Use regex to find papers by the author (like working search feature)
            query = {"authors_string": {"$regex": author_name, "$options": "i"}}
            
            # Get all papers by this author (get more for better vector search pool)
            author_papers = list(self.mongo_client.collection.find(query).limit(1000))
            
            if verbose:
                print(f"     Found {len(author_papers)} papers by '{author_name}'")
            
            if author_papers:
                # Stage 2: Manual vector similarity calculation on author papers
                if verbose:
                    print(f"     Stage 2: Calculating vector similarity for {len(author_papers)} author papers")
                
                # Calculate cosine similarity between query and each author paper
                import numpy as np
                
                papers_with_scores = []
                for paper in author_papers:
                    if "vector" in paper and paper["vector"]:
                        # Calculate cosine similarity
                        paper_vector = np.array(paper["vector"])
                        query_vector = np.array(query_embedding)
                        
                        # Cosine similarity
                        similarity = np.dot(query_vector, paper_vector) / (
                            np.linalg.norm(query_vector) * np.linalg.norm(paper_vector)
                        )
                        
                        # Format paper to match vector search output
                        formatted_paper = {
                            "_id": paper.get("_id"),
                            "title": paper.get("title"),
                            "abstract": paper.get("abstract"),
                            "authors_string": paper.get("authors_string"),
                            "journal": paper.get("journal"),
                            "publication_date": paper.get("publication_date"),
                            "doi": paper.get("doi"),
                            "work_id": paper.get("work_id"),
                            "subfields": paper.get("subfields", []),
                            "cited_by_count": paper.get("cited_by_count", 0),
                            "keywords": paper.get("keywords", []),
                            "open_access": paper.get("open_access"),
                            "relevance_score": paper.get("relevance_score", 0),
                            "score": float(similarity)  # Vector similarity score
                        }
                        papers_with_scores.append((formatted_paper, similarity))
                
                # Sort by similarity score and take top results
                papers_with_scores.sort(key=lambda x: x[1], reverse=True)
                papers = [paper for paper, score in papers_with_scores[:limit]]
                
                if verbose:
                    print(f"     Vector similarity calculation: {len(papers)} top results")
            else:
                papers = []
        else:
            # Use standard vector search for non-author queries
            num_candidates = 50  # Use 50 candidates as requested
            search_limit = limit
            
            papers = self.mongo_client.vector_search(
                query_vector=query_embedding,
                num_candidates=num_candidates,
                limit=search_limit,
                filters=filters
            )
        
        # No post-filtering needed since author queries use direct MongoDB search
        
        if not papers:
            return {
                "query": query,
                "query_plan": query_plan,
                "retrieved_papers": [],
                "answer": "The current database does not contain verified information on this topic. Please refine your search terms or explore related VergeSci posts.",
                "metadata": {
                    "num_papers": 0,
                    "model": Config.GPT_MODEL,
                    "preprocessor_used": True
                }
            }
        
        # STAGE 3: Generate grounded answer
        if verbose:
            print(f"\n[Stage 3/3] Answer Generation")
            print(f"     Retrieved {len(papers)} papers")
            print(f"     Generating Nobel-level synthesis...")
        
        context = format_context_for_llm(papers)
        user_prompt = get_search_mode_user_prompt(query, context)
        
        # Call GPT with strict system prompt
        try:
            # Build completion parameters
            completion_params = {
                "model": Config.GPT_MODEL,
                "messages": [
                    {"role": "system", "content": SEARCH_MODE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ]
            }
            
            # GPT-5 Nano uses defaults - doesn't support custom temperature or max_tokens
            if "gpt-5" not in Config.GPT_MODEL.lower():
                completion_params["temperature"] = Config.TEMPERATURE
                completion_params["max_tokens"] = Config.MAX_RESPONSE_TOKENS
            
            response = self.openai_client.chat.completions.create(**completion_params)
            
            answer = response.choices[0].message.content
            
            if verbose:
                print(f"\n{'='*80}")
                print("ANSWER")
                print(f"{'='*80}\n")
                print(answer)
                print(f"\n{'='*80}\n")
            
            return {
                "query": query,
                "query_plan": query_plan,
                "search_text": search_text,
                "filters": filters,
                "retrieved_papers": papers,
                "answer": answer,
                "metadata": {
                    "num_papers": len(papers),
                    "model": Config.GPT_MODEL,
                    "temperature": Config.TEMPERATURE,
                    "num_candidates": num_candidates,
                    "limit": limit,
                    "preprocessor_used": True,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                }
            }
        
        except Exception as e:
            raise RuntimeError(f"Failed to generate answer: {e}")
    
    def _build_filters_from_plan(self, query_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build MongoDB filters from query plan constraints
        
        Args:
            query_plan: Structured query plan from preprocessor
        
        Returns:
            MongoDB filter dictionary
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
        
        # Journal constraints (use $in for exact matches, not regex)
        journals = constraints.get("JournalsOrSources", [])
        if journals:
            filters["journal"] = {"$in": journals}
        
        # Author constraints - use regex pre-filtering on indexed authors_string field
        # Check if query mentions author search patterns
        original_query = query_plan.get("Intent", "").lower()
        entities = query_plan.get("EntitiesAndConcepts", {}).get("PrimaryEntities", [])
        
        # Enhanced author detection with regex pre-filtering
        author_keywords = ["by ", "written by", "authored by", "author", "papers by", "clifford", "saper"]
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
                    # MongoDB Atlas vector search doesn't support $regex in filters
                    # But we can use a different approach: search for papers that contain the author name
                    # Since we can't use regex, we'll need to use post-filtering with a larger search pool
                    filters["_author_query"] = author_name
                    author_found = True
                    break
            
            # Fallback to entity-based detection if no regex match
            if not author_found:
                for entity in entities:
                    words = entity.split()
                    if len(words) <= 3 and all(word[0].isupper() if word else False for word in words):
                        if entity not in ["Attention", "Memory", "Perception"]:  # Exclude common neuroscience terms
                            # Store entity name for post-processing
                            filters["_author_query"] = entity
                            break
        
        return filters if filters else None
    
    def close(self):
        """Clean up resources"""
        self.mongo_client.close()

