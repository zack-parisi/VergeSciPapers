"""
OpenAI Embedding Generation
Handles query vectorization using OpenAI's text-embedding-3-small
"""
from typing import List
from openai import OpenAI
from config import Config


class EmbeddingGenerator:
    """Generate embeddings for queries using OpenAI"""
    
    def __init__(self):
        """Initialize OpenAI client"""
        self.client = OpenAI(api_key=Config.OPENAI_API_KEY)
        self.model = Config.VECTOR_MODEL
        self.dimensions = Config.VECTOR_DIMENSIONS
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector for input text
        
        Args:
            text: Input text to embed
        
        Returns:
            1536-dimensional embedding vector
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text,
                dimensions=self.dimensions
            )
            embedding = response.data[0].embedding
            
            if len(embedding) != self.dimensions:
                raise ValueError(
                    f"Embedding dimension mismatch: expected {self.dimensions}, "
                    f"got {len(embedding)}"
                )
            
            return embedding
        except Exception as e:
            raise RuntimeError(f"Failed to generate embedding: {e}")
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batch
        
        Args:
            texts: List of input texts
        
        Returns:
            List of embedding vectors
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=texts,
                dimensions=self.dimensions
            )
            embeddings = [data.embedding for data in response.data]
            return embeddings
        except Exception as e:
            raise RuntimeError(f"Failed to generate batch embeddings: {e}")


