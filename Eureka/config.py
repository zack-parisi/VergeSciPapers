"""
Eureka Configuration Management
Loads environment variables and provides configuration settings
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
# First try local .env, then fall back to forum's .env.local
eureka_env = Path(__file__).parent / ".env"
forum_env = Path(__file__).parent.parent / "verge-discussion-forum" / ".env.local"

if eureka_env.exists():
    load_dotenv(eureka_env)
elif forum_env.exists():
    load_dotenv(forum_env)
else:
    raise FileNotFoundError(
        "No .env file found. Please create Eureka/.env or ensure "
        "verge-discussion-forum/.env.local exists with OPENAI_API_KEY"
    )


class Config:
    """Centralized configuration for Eureka system"""
    
    # MongoDB
    MONGODB_URI = os.getenv("MONGODB_URI")
    MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "verge_neuro_lit_topics")
    MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "papers_clean")
    
    # OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    
    # Vector Search
    VECTOR_INDEX_NAME = os.getenv("VECTOR_INDEX_NAME", "vector_index")
    VECTOR_DIMENSIONS = int(os.getenv("VECTOR_DIMENSIONS", "1536"))
    VECTOR_MODEL = os.getenv("VECTOR_MODEL", "text-embedding-3-small")
    
    # Search Parameters
    DEFAULT_NUM_CANDIDATES = int(os.getenv("DEFAULT_NUM_CANDIDATES", "100"))
    DEFAULT_LIMIT = int(os.getenv("DEFAULT_LIMIT", "3"))
    MAX_TOKENS_PER_CHUNK = int(os.getenv("MAX_TOKENS_PER_CHUNK", "1200"))
    OVERLAP_TOKENS = int(os.getenv("OVERLAP_TOKENS", "120"))
    
    # LLM Configuration
    GPT_MODEL = os.getenv("GPT_MODEL", "gpt-5-nano")  # Fast, cheap GPT-5 for summarization/classification
    MAX_RESPONSE_TOKENS = int(os.getenv("MAX_RESPONSE_TOKENS", "2000"))
    TEMPERATURE = float(os.getenv("TEMPERATURE", "0.1"))
    
    @classmethod
    def validate(cls):
        """Validate critical configuration"""
        errors = []
        
        if not cls.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required")
        
        if not cls.MONGODB_URI:
            errors.append("MONGODB_URI is required")
        
        if cls.VECTOR_DIMENSIONS != 1536:
            errors.append(f"VECTOR_DIMENSIONS must be 1536 for {cls.VECTOR_MODEL}")
        
        if errors:
            raise ValueError("Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors))
        
        return True


# Validate on import
Config.validate()

