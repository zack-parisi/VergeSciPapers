import pymongo
import json
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import certifi
from collections import defaultdict, Counter
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit"
COLLECTION_NAME = "papers_clean"

class ContentRecommender:
    def __init__(self):
        self.client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        self.db = self.client[MONGO_DB]
        self.collection = self.db[COLLECTION_NAME]
        
        # Load config
        try:
            with open('config.json', 'r') as f:
                self.config = json.load(f)
        except FileNotFoundError:
            self.config = {}
    
    def get_user_preferences(self, user_id=None):
        """Get user preferences - in a real system, this would come from user profile"""
        # For now, use config settings
        return {
            "preferred_subfields": self.config.get("enabled_subfields", ["Neuroscience", "Cognitive science"]),
            "reading_history": [],  # Would be populated from user data
            "preferred_journals": [],
            "min_citations": 5,
            "max_days_old": 3650,
            "preferred_authors": []
        }
    
    def extract_paper_features(self, paper):
        """Extract features from a paper for similarity calculation"""
        features = {
            "text": f"{paper.get('title', '')} {paper.get('abstract', '')}",
            "subfields": paper.get("subfields", []),
            "authors": paper.get("authors", []),
            "journal": paper.get("journal", ""),
            "citations": paper.get("cited_by_count", 0),
            "concepts_count": paper.get("concepts_count", 0),
            "publication_date": paper.get("publication_date", ""),
            "keywords": paper.get("keywords", []),
            "mesh_terms": paper.get("mesh_terms", [])
        }
        return features
    
    def calculate_content_similarity(self, papers, target_paper):
        """Calculate content similarity between papers using TF-IDF and cosine similarity"""
        if not papers:
            return []
        
        # Prepare text data
        texts = []
        paper_ids = []
        
        for paper in papers:
            text = f"{paper.get('title', '')} {paper.get('abstract', '')}"
            texts.append(text)
            paper_ids.append(paper.get('_id'))
        
        # Add target paper
        target_text = f"{target_paper.get('title', '')} {target_paper.get('abstract', '')}"
        texts.append(target_text)
        
        # Create TF-IDF vectors
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=2
        )
        
        try:
            tfidf_matrix = vectorizer.fit_transform(texts)
            
            # Calculate cosine similarity with target paper
            target_vector = tfidf_matrix[-1]
            similarities = cosine_similarity(target_vector, tfidf_matrix[:-1]).flatten()
            
            # Create similarity scores
            similarity_scores = []
            for i, paper_id in enumerate(paper_ids):
                similarity_scores.append({
                    "paper_id": paper_id,
                    "similarity_score": float(similarities[i])
                })
            
            return sorted(similarity_scores, key=lambda x: x["similarity_score"], reverse=True)
            
        except Exception as e:
            print(f"Error calculating content similarity: {e}")
            return []
    
    def find_similar_papers(self, target_paper, limit=10):
        """Find papers similar to a target paper"""
        # Get papers from the same subfields
        target_subfields = target_paper.get("subfields", [])
        query = {
            "subfields": {"$in": target_subfields},
            "_id": {"$ne": target_paper.get("_id")}
        }
        
        similar_papers = list(self.collection.find(query).limit(100))
        
        if not similar_papers:
            return []
        
        # Calculate content similarity
        similarity_scores = self.calculate_content_similarity(similar_papers, target_paper)
        
        # Get the actual papers with their similarity scores
        similar_papers_with_scores = []
        for sim_score in similarity_scores[:limit]:
            paper = next((p for p in similar_papers if p["_id"] == sim_score["paper_id"]), None)
            if paper:
                paper["similarity_score"] = sim_score["similarity_score"]
                similar_papers_with_scores.append(paper)
        
        return similar_papers_with_scores
    
    def generate_personalized_recommendations(self, user_preferences, limit=20):
        """Generate personalized recommendations based on user preferences"""
        # Build query based on user preferences
        query = {
            "cited_by_count": {"$gte": user_preferences.get("min_citations", 5)},
            "subfields": {"$in": user_preferences.get("preferred_subfields", [])}
        }
        
        # Add date filter
        max_days_old = user_preferences.get("max_days_old", 3650)
        cutoff_date = (datetime.utcnow() - timedelta(days=max_days_old)).strftime("%Y-%m-%d")
        query["publication_date"] = {"$gte": cutoff_date}
        
        # Get candidate papers
        candidate_papers = list(self.collection.find(query).limit(500))
        
        if not candidate_papers:
            return []
        
        # Use the simplified ranking algorithm
        ranked_papers = self._apply_ranking_algorithm(candidate_papers)
        
        return ranked_papers[:limit]
    
    def _apply_ranking_algorithm(self, papers):
        """
        Apply the simplified ranking algorithm:
        ranking = (1 - alpha * Rnorm) + beta * Cnorm
        """
        if not papers:
            return []
        
        # Get ranking parameters from config
        ranking_config = self.config.get("ranking_algorithm", {"alpha": 0.4, "beta": 0.6})
        alpha = ranking_config.get("alpha", 0.4)
        beta = ranking_config.get("beta", 0.6)
        
        # Find max values for normalization
        max_citations = max(p.get("cited_by_count", 0) for p in papers)
        
        # Find oldest publication date for recency normalization
        oldest_date = min(
            [datetime.strptime(p["publication_date"], "%Y-%m-%d") for p in papers if p.get("publication_date")],
            default=datetime.utcnow()
        )
        max_days_since_pub = (datetime.utcnow() - oldest_date).days
        
        # Calculate scores for each paper
        for paper in papers:
            # Recency normalization (Rnorm)
            try:
                pub_date = datetime.strptime(paper.get("publication_date"), "%Y-%m-%d")
                days_since_pub = (datetime.utcnow() - pub_date).days
                Rnorm = days_since_pub / max_days_since_pub if max_days_since_pub > 0 else 0
            except (ValueError, TypeError):
                Rnorm = 0

            # Citation normalization (Cnorm)
            citations = paper.get("cited_by_count", 0)
            Cnorm = citations / max_citations if max_citations > 0 else 0

            # Calculate ranking score
            ranking_score = (1 - alpha * Rnorm) + (beta * Cnorm)
            paper["ranking_score"] = ranking_score
        
        # Sort by ranking score (higher is better)
        papers.sort(key=lambda p: p.get("ranking_score", 0), reverse=True)
        return papers
    
    def calculate_user_preference_score(self, paper, user_preferences):
        """Calculate how well a paper matches user preferences"""
        score = 0.0
        
        # Subfield match (0-0.4)
        paper_subfields = set(paper.get("subfields", []))
        preferred_subfields = set(user_preferences.get("preferred_subfields", []))
        subfield_overlap = len(paper_subfields.intersection(preferred_subfields))
        if preferred_subfields:
            score += 0.4 * (subfield_overlap / len(preferred_subfields))
        
        # Citation score (0-0.3)
        citations = paper.get("cited_by_count", 0)
        if citations >= 50:
            score += 0.3
        elif citations >= 20:
            score += 0.2
        elif citations >= 10:
            score += 0.1
        
        # Abstract quality score (0-0.2) - simplified based on length
        abstract = paper.get("abstract", "")
        if abstract:
            abstract_length = len(abstract)
            if abstract_length >= 500:
                score += 0.2
            elif abstract_length >= 300:
                score += 0.15
            elif abstract_length >= 150:
                score += 0.1
        
        # Recency score (0-0.1)
        try:
            pub_date = datetime.strptime(paper.get("publication_date", ""), "%Y-%m-%d")
            days_old = (datetime.utcnow() - pub_date).days
            if days_old <= 365:
                score += 0.1
            elif days_old <= 730:
                score += 0.05
        except:
            pass
        
        return score
    
    def get_trending_papers(self, subfields, days=30, limit=10):
        """Get trending papers from recent days"""
        cutoff_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        query = {
            "publication_date": {"$gte": cutoff_date},
            "subfields": {"$in": subfields}
        }
        
        trending_papers = list(self.collection.find(query).sort("cited_by_count", -1).limit(limit))
        return self._apply_ranking_algorithm(trending_papers)
    
    def get_collaborative_recommendations(self, user_id, limit=10):
        """Placeholder for collaborative filtering - would use user reading history"""
        # This would be implemented with user reading history data
        return []
    
    def generate_diverse_recommendations(self, subfields, limit=20):
        """Generate diverse recommendations across subfields"""
        query = {"subfields": {"$in": subfields}}
        all_papers = list(self.collection.find(query).limit(500))
        
        if not all_papers:
            return []
        
        # Apply ranking algorithm
        ranked_papers = self._apply_ranking_algorithm(all_papers)
        
        # Ensure diversity by taking top papers from each subfield
        diverse_recommendations = []
        used_subfields = set()
        
        for subfield in subfields:
            subfield_papers = [p for p in ranked_papers if subfield in p.get("subfields", [])]
            if subfield_papers:
                diverse_recommendations.extend(subfield_papers[:2])  # Top 2 from each subfield
                used_subfields.add(subfield)
        
        # Fill remaining slots with top overall papers
        remaining_papers = [p for p in ranked_papers if p not in diverse_recommendations]
        diverse_recommendations.extend(remaining_papers[:limit - len(diverse_recommendations)])
        
        return diverse_recommendations[:limit]
    
    def close(self):
        """Close database connection"""
        if hasattr(self, 'client'):
            self.client.close()

def main():
    """Test the content recommender"""
    recommender = ContentRecommender()
    
    try:
        # Test personalized recommendations
        user_prefs = {
            "preferred_subfields": ["Neuroscience", "Cognitive neuroscience"],
            "min_citations": 10,
            "max_days_old": 3650
        }
        
        recommendations = recommender.generate_personalized_recommendations(user_prefs, limit=10)
        
        print("=== PERSONALIZED RECOMMENDATIONS ===")
        for i, paper in enumerate(recommendations[:5]):
            print(f"\n{i+1}. {paper.get('title', 'No title')}")
            print(f"   Score: {paper.get('ranking_score', 0):.3f}")
            print(f"   Citations: {paper.get('cited_by_count', 0)}")
            print(f"   Subfields: {', '.join(paper.get('subfields', [])[:3])}")
        
        # Test trending papers
        trending = recommender.get_trending_papers(["Neuroscience"], days=365, limit=5)
        
        print("\n=== TRENDING PAPERS ===")
        for i, paper in enumerate(trending[:3]):
            print(f"\n{i+1}. {paper.get('title', 'No title')}")
            print(f"   Score: {paper.get('ranking_score', 0):.3f}")
            print(f"   Citations: {paper.get('cited_by_count', 0)}")
    
    finally:
        recommender.close()

if __name__ == "__main__":
    main() 