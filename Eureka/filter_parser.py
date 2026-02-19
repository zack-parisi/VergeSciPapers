"""
Natural Language Filter Parser
Extracts filters (author, year, journal) from search queries
"""
import re
from typing import Dict, Any, Tuple
from datetime import datetime
from openai import OpenAI
from config import Config


class FilterParser:
    """Parse natural language queries to extract search filters"""
    
    def __init__(self):
        """Initialize filter parser"""
        self.current_year = datetime.now().year
        self.openai_client = OpenAI(api_key=Config.OPENAI_API_KEY)
    
    def parse_filters(self, query: str) -> Tuple[str, Dict[str, Any]]:
        """
        Extract filters from natural language query
        
        Args:
            query: User's natural language search query
        
        Returns:
            Tuple of (cleaned_query, filters_dict)
            - cleaned_query: Query with filter terms removed
            - filters_dict: MongoDB filters extracted from query
        """
        # Use GPT to extract filters intelligently
        system_prompt = f"""Extract search filters from the neuroscience query.

CURRENT YEAR: {self.current_year}

Extract these filter types:
1. Author names (e.g., "by Smith", "written by Jones")
2. Year ranges (e.g., "from 2020", "in 2023", "this year", "last year")
3. Journal names (e.g., "in Nature", "published in Science")

Return JSON:
{{
  "author": "author name or null",
  "year_from": "YYYY or null",
  "year_to": "YYYY or null",
  "journal": "journal name or null",
  "cleaned_query": "query with filter terms removed"
}}

Examples:
- "papers by Smith from 2020" → {{"author": "Smith", "year_from": "2020", "cleaned_query": "papers"}}
- "dopamine in Nature" → {{"journal": "Nature", "cleaned_query": "dopamine"}}
- "gut-brain axis this year" → {{"year_from": "{self.current_year}", "year_to": "{self.current_year}", "cleaned_query": "gut-brain axis"}}
"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",  # Cheaper and supports JSON mode
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            
            import json
            result = json.loads(response.choices[0].message.content)
            
            # Build MongoDB filters
            filters = {}
            
            # Author filter (case-insensitive regex)
            if result.get("author"):
                filters["authors_string"] = {"$regex": result["author"], "$options": "i"}
            
            # Date range filter
            year_from = result.get("year_from")
            year_to = result.get("year_to")
            if year_from or year_to:
                date_filter = {}
                if year_from:
                    date_filter["$gte"] = f"{year_from}-01-01"
                if year_to:
                    date_filter["$lte"] = f"{year_to}-12-31"
                filters["publication_date"] = date_filter
            
            # Journal filter (case-insensitive exact match or regex)
            if result.get("journal"):
                filters["journal"] = {"$regex": result["journal"], "$options": "i"}
            
            cleaned_query = result.get("cleaned_query", query)
            
            return cleaned_query, filters
        
        except Exception as e:
            # Fallback: use original query with no filters
            print(f"Filter extraction failed: {e}")
            return query, {}
    
    def parse_filters_simple(self, query: str) -> Tuple[str, Dict[str, Any]]:
        """
        Simple regex-based filter extraction (fallback, no API call)
        
        Args:
            query: User's natural language search query
        
        Returns:
            Tuple of (cleaned_query, filters_dict)
        """
        filters = {}
        cleaned = query
        
        # Extract year patterns
        # "from 2020", "since 2023", "in 2022"
        year_from_match = re.search(r'\b(?:from|since)\s+(\d{4})\b', query, re.IGNORECASE)
        if year_from_match:
            year = year_from_match.group(1)
            filters.setdefault("publication_date", {})["$gte"] = f"{year}-01-01"
            cleaned = cleaned.replace(year_from_match.group(0), "")
        
        # "to 2023", "until 2022"
        year_to_match = re.search(r'\b(?:to|until)\s+(\d{4})\b', query, re.IGNORECASE)
        if year_to_match:
            year = year_to_match.group(1)
            filters.setdefault("publication_date", {})["$lte"] = f"{year}-12-31"
            cleaned = cleaned.replace(year_to_match.group(0), "")
        
        # "in 2023", "published in 2022"
        year_in_match = re.search(r'\b(?:in|published in)\s+(\d{4})\b', query, re.IGNORECASE)
        if year_in_match and "publication_date" not in filters:
            year = year_in_match.group(1)
            filters["publication_date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}
            cleaned = cleaned.replace(year_in_match.group(0), "")
        
        # "this year"
        if re.search(r'\bthis year\b', query, re.IGNORECASE):
            filters["publication_date"] = {
                "$gte": f"{self.current_year}-01-01",
                "$lte": f"{self.current_year}-12-31"
            }
            cleaned = re.sub(r'\bthis year\b', "", cleaned, flags=re.IGNORECASE)
        
        # "last year"
        if re.search(r'\blast year\b', query, re.IGNORECASE):
            last_year = self.current_year - 1
            filters["publication_date"] = {
                "$gte": f"{last_year}-01-01",
                "$lte": f"{last_year}-12-31"
            }
            cleaned = re.sub(r'\blast year\b', "", cleaned, flags=re.IGNORECASE)
        
        # Extract author patterns
        # "by AuthorName", "written by AuthorName", "authored by AuthorName"
        author_match = re.search(r'\b(?:by|written by|authored by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', query)
        if author_match:
            author = author_match.group(1)
            filters["authors_string"] = {"$regex": author, "$options": "i"}
            cleaned = cleaned.replace(author_match.group(0), "")
        
        # Extract journal patterns
        # "in Nature", "published in Science"
        journal_match = re.search(r'\b(?:in|published in)\s+([A-Z][a-zA-Z\s&]+?)(?:\s+(?:from|in|since|\d{4})|$)', query)
        if journal_match and "publication_date" not in query[journal_match.start():journal_match.end()]:
            journal = journal_match.group(1).strip()
            filters["journal"] = {"$regex": journal, "$options": "i"}
            cleaned = cleaned.replace(journal_match.group(0), "")
        
        # Clean up extra whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned, filters

