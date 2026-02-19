"""
Eureka Translator Mode
Two-node approach: Query Preprocessor → Structured RAG Executor
"""
import json
from typing import Dict, Any
from openai import OpenAI
from config import Config
from embeddings import EmbeddingGenerator
from mongo_client import MongoVectorClient, format_context_for_llm
from prompts import (
    TRANSLATOR_NODE1_SYSTEM_PROMPT,
    SEARCH_MODE_SYSTEM_PROMPT,
    get_translator_node1_user_prompt,
    get_translator_node2_user_prompt
)


class TranslatorNode1:
    """
    Node 1: Query Preprocessor
    Transforms raw query into structured RAG Query Plan (JSON)
    """
    
    def __init__(self):
        """Initialize Node 1"""
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def process_query(self, query: str, verbose: bool = True) -> Dict[str, Any]:
        """
        Transform raw query into structured RAG Query Plan
        
        Args:
            query: Raw user query
            verbose: Print progress information
        
        Returns:
            Structured query plan as dictionary
        """
        if verbose:
            print(f"\n{'='*80}")
            print("TRANSLATOR NODE 1: QUERY PREPROCESSOR")
            print(f"{'='*80}")
            print(f"Raw Query: {query}\n")
        
        user_prompt = get_translator_node1_user_prompt(query)
        
        try:
            # Use JSON mode for structured output
            response = self.openai_client.chat.completions.create(
                model=Config.GPT_MODEL,
                messages=[
                    {"role": "system", "content": TRANSLATOR_NODE1_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0,  # Deterministic for query parsing
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            plan_json = response.choices[0].message.content
            query_plan = json.loads(plan_json)
            
            if verbose:
                print("Query Plan Generated:")
                print(json.dumps(query_plan, indent=2))
                print(f"\n{'='*80}\n")
            
            # Check if clarifications needed
            if query_plan.get("ClarificationsNeeded") and len(query_plan["ClarificationsNeeded"]) > 0:
                if verbose:
                    print("CLARIFICATIONS NEEDED:")
                    for i, q in enumerate(query_plan["ClarificationsNeeded"], 1):
                        print(f"  {i}. {q}")
                    print()
            
            return query_plan
        
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse query plan JSON: {e}")
        except Exception as e:
            raise RuntimeError(f"Node 1 processing failed: {e}")


class TranslatorNode2:
    """
    Node 2: Structured RAG Executor
    Takes query plan → retrieves papers → generates grounded answer
    """
    
    def __init__(self):
        """Initialize Node 2"""
        self.embedding_generator = EmbeddingGenerator()
        self.mongo_client = MongoVectorClient()
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def execute_plan(
        self,
        query_plan: Dict[str, Any],
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        Execute structured RAG query plan
        
        Args:
            query_plan: Structured query plan from Node 1
            verbose: Print progress information
        
        Returns:
            Dictionary with query plan, retrieved papers, answer, metadata
        """
        if verbose:
            print(f"\n{'='*80}")
            print("TRANSLATOR NODE 2: STRUCTURED RAG EXECUTOR")
            print(f"{'='*80}\n")
        
        # Extract retrieval parameters from plan
        retrieval_directives = query_plan.get("RetrievalDirectives", {})
        limit = retrieval_directives.get("TopK", Config.DEFAULT_LIMIT)
        
        # Smart candidate calculation: increase candidates when filters are present
        # to account for filtering reducing the result set
        constraints = query_plan.get("Constraints", {})
        has_filters = any([
            constraints.get("Temporal", {}).get("From"),
            constraints.get("Temporal", {}).get("To"),
            constraints.get("JournalsOrSources"),
            constraints.get("StudyTypes")
        ])
        
        if has_filters:
            # Use 50x candidates when filters present to search deeper
            num_candidates = min(limit * 50, 500)
            if verbose:
                print(f"     Note: Using {num_candidates} candidates due to filters")
        else:
            # Standard 10x multiplier without filters
            num_candidates = limit * 10
        
        # Build MongoDB filters from constraints
        constraints = query_plan.get("Constraints", {})
        filters = self._build_filters(constraints, query_plan)
        
        # Step 1: Generate embedding for the intent (or decomposed queries)
        intent = query_plan.get("Intent", "")
        decomposition = query_plan.get("Decomposition", [])
        
        if decomposition:
            # Use first subquery as primary search query
            search_text = decomposition[0].get("subquery", intent)
        else:
            search_text = intent
        
        if verbose:
            print(f"[1/3] Generating embedding for: '{search_text[:100]}...'")
        
        query_embedding = self.embedding_generator.generate_embedding(search_text)
        
        # Step 2: Vector search
        if verbose:
            print(f"[2/3] Executing vector search...")
            if filters:
                print(f"     Filters: {filters}")
        
        papers = self.mongo_client.vector_search(
            query_vector=query_embedding,
            num_candidates=num_candidates,
            limit=limit,
            filters=filters
        )
        
        if not papers:
            return {
                "query_plan": query_plan,
                "retrieved_papers": [],
                "answer": "The current database does not contain verified information on this topic. Please refine your search terms or explore related VergeSci posts.",
                "metadata": {
                    "num_papers": 0,
                    "model": Config.GPT_MODEL
                }
            }
        
        # Step 3: Generate answer with query plan context
        if verbose:
            print(f"[3/3] Generating answer with structured plan...")
        
        context = format_context_for_llm(papers)
        user_prompt = get_translator_node2_user_prompt(query_plan, context)
        
        try:
            response = self.openai_client.chat.completions.create(
                model=Config.GPT_MODEL,
                messages=[
                    {"role": "system", "content": SEARCH_MODE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=Config.TEMPERATURE,
                max_tokens=Config.MAX_RESPONSE_TOKENS
            )
            
            answer = response.choices[0].message.content
            
            if verbose:
                print(f"\n{'='*80}")
                print("ANSWER")
                print(f"{'='*80}\n")
                print(answer)
                print(f"\n{'='*80}\n")
            
            return {
                "query_plan": query_plan,
                "retrieved_papers": papers,
                "answer": answer,
                "metadata": {
                    "num_papers": len(papers),
                    "model": Config.GPT_MODEL,
                    "temperature": Config.TEMPERATURE,
                    "num_candidates": num_candidates,
                    "limit": limit,
                    "filters": filters,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                }
            }
        
        except Exception as e:
            raise RuntimeError(f"Failed to generate answer: {e}")
    
    def _build_filters(
        self,
        constraints: Dict[str, Any],
        query_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build MongoDB filters from query plan constraints"""
        filters = {}
        
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
        
        # Journal constraints
        journals = constraints.get("JournalsOrSources", [])
        if journals:
            filters["journal"] = {"$in": journals}
        
        # Subfield constraints (from ScientificFacets)
        scientific_facets = query_plan.get("ScientificFacets", {})
        # Note: This would need domain knowledge to map analysis levels to subfields
        # For now, we'll let the vector search handle semantic matching
        
        return filters if filters else None
    
    def close(self):
        """Clean up resources"""
        self.mongo_client.close()


class TranslatorMode:
    """
    Full Translator Mode: Combines Node 1 and Node 2
    """
    
    def __init__(self):
        """Initialize both nodes"""
        self.node1 = TranslatorNode1()
        self.node2 = TranslatorNode2()
    
    def translate(self, query: str, verbose: bool = True) -> Dict[str, Any]:
        """
        Execute full translator pipeline
        
        Args:
            query: Raw user query
            verbose: Print progress information
        
        Returns:
            Complete result with query plan, papers, answer, metadata
        """
        # Node 1: Preprocess query
        query_plan = self.node1.process_query(query, verbose=verbose)
        
        # Check if clarifications needed (user would handle this interactively)
        clarifications = query_plan.get("ClarificationsNeeded", [])
        if clarifications:
            print(f"\nNote: Query could benefit from clarifications, but proceeding with best-effort retrieval.\n")
        
        # Node 2: Execute structured RAG
        result = self.node2.execute_plan(query_plan, verbose=verbose)
        
        return result
    
    def close(self):
        """Clean up resources"""
        self.node2.close()

