"""
Eureka Chat Mode
Super-fast, efficient chatbot for neuroscience questions
Direct OpenAI API - no RAG, no database grounding
"""
from typing import Dict, Any
from openai import OpenAI
from config import Config
from chat_prompt import EUREKA_CHAT_SYSTEM_PROMPT


class ChatMode:
    """
    Chat Mode: Fast, efficient neuroscience chatbot
    User Query → Direct OpenAI API Response
    
    No RAG, no database - just pure OpenAI with the original prompt
    Optimized for maximum speed
    """
    
    def __init__(self):
        """Initialize Chat Mode components"""
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def chat(
        self,
        query: str,
        verbose: bool = False
    ) -> Dict[str, Any]:
        """
        Execute fast chat mode - direct OpenAI API call
        
        Args:
            query: User's neuroscience question
            verbose: Print progress information
        
        Returns:
            Dictionary containing query, answer, and metadata
        """
        if verbose:
            print(f"\n{'='*80}")
            print("EUREKA CHAT MODE (DIRECT OPENAI)")
            print(f"{'='*80}")
            print(f"Query: {query}\n")
        
        # Direct OpenAI API call - no RAG, no database
        if verbose:
            print("[Generating Response]")
        
        format_instructions = """
FORMAT REQUIREMENTS:
- Respond ONLY in Markdown.
- Use `##` for main sections (e.g., Key Idea, Mechanisms, Evidence, Relevance, Open Questions).
- Use `###` for sub-sections (e.g., Receptor Actions and Cellular Excitability).
- Use paragraph text under each heading for narrative explanations.
- Use `-` bullets for enumerations or lists.
- Do not include any content outside this Markdown structure.
""".strip()

        user_message = f"{query}\n\n{format_instructions}"

        # Build completion parameters
        completion_params = {
            "model": Config.GPT_MODEL,
            "messages": [
                {"role": "system", "content": EUREKA_CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
        }
        
        # GPT-5 Nano uses defaults - doesn't support custom max_tokens or temperature
        if "gpt-5" not in Config.GPT_MODEL.lower():
            completion_params["max_tokens"] = 1500  # Good length for comprehensive answers
            completion_params["temperature"] = 0.7  # Balanced for natural responses
        
        response = self.openai_client.chat.completions.create(**completion_params)
        answer = response.choices[0].message.content
        
        if verbose:
            print(f"     Response generated ({len(answer)} chars)")
        
        return {
            "query": query,
            "answer": answer,
            "papers": [],  # No papers since we're not using RAG
            "metadata": {
                "mode": "chat",
                "num_papers": 0
            }
        }
    
    def close(self):
        """Close connections (no-op since no database)"""
        pass

