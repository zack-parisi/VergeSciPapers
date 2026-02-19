"""
Query Preprocessor (Node 1)
Transforms raw queries into structured RAG Query Plans
"""
import json
from datetime import datetime
from typing import Dict, Any
from openai import OpenAI
from config import Config
from prompts import TRANSLATOR_NODE1_SYSTEM_PROMPT, get_translator_node1_user_prompt


class QueryPreprocessor:
    """
    Preprocessor that converts raw user queries into structured JSON query plans.
    This is Node 1 of the Eureka pipeline - it runs BEFORE vector search.
    """
    
    def __init__(self):
        """Initialize preprocessor"""
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def preprocess(self, query: str, verbose: bool = True) -> Dict[str, Any]:
        """
        Transform raw query into structured RAG Query Plan
        
        Args:
            query: Raw user query
            verbose: Print progress information
        
        Returns:
            Structured query plan as dictionary
        """
        if verbose:
            print(f"[Preprocessor] Analyzing query...")
        
        user_prompt = get_translator_node1_user_prompt(query)
        
        try:
            # Use JSON mode for structured output
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
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
                print(f"     Intent: {query_plan.get('Intent', 'N/A')[:80]}...")
                if query_plan.get("Constraints", {}).get("Temporal", {}).get("From"):
                    print(f"     Temporal filter detected: {query_plan['Constraints']['Temporal']}")
                if query_plan.get("ClarificationsNeeded") and len(query_plan["ClarificationsNeeded"]) > 0:
                    print(f"     Clarifications may improve results: {len(query_plan['ClarificationsNeeded'])} items")
            
            return query_plan
        
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse query plan JSON: {e}")
        except Exception as e:
            raise RuntimeError(f"Preprocessing failed: {e}")


