import pymongo
import json
from datetime import datetime
import os
from dotenv import load_dotenv
import certifi
from collections import defaultdict

load_dotenv()

# --- Configuration ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = "verge_neuro_lit"
COLLECTION_NAME = "papers_clean"

def get_user_config():
    """Loads the researcher's configuration from config.json."""
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: config.json not found. Please create it.")
        return None

def get_filtered_papers(db, subfields, limit=1000):
    """Fetches papers from MongoDB that match at least one of the specified subfields."""
    query = {"subfields": {"$in": subfields}}
    return list(db[COLLECTION_NAME].find(query).limit(limit))

def calculate_ranks(papers, alpha, beta):
    """
    Calculates relevance scores using the simplified algorithm:
    ranking = (1 - alpha * Rnorm) + beta * Cnorm
    
    Where:
    - Rnorm = days since published / max days since publication in subdataset
    - Cnorm = citations / max citations in subdataset
    - alpha + beta = 1
    """
    if not papers:
        return []

    # Find max values for normalization within the filtered set
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

def analyze_subfield_distribution(papers, subfields):
    """Analyzes the distribution of papers across subfields."""
    subfield_counts = defaultdict(int)
    subfield_scores = defaultdict(list)
    
    for paper in papers:
        paper_subfields = paper.get("subfields", [])
        for subfield in paper_subfields:
            if subfield in subfields:
                subfield_counts[subfield] += 1
                subfield_scores[subfield].append(paper.get("ranking_score", 0))
    
    return subfield_counts, subfield_scores

def generate_recommendations(papers, subfields, top_n=20):
    """Generates personalized recommendations based on subfield preferences."""
    if not papers:
        return []
    
    # Analyze subfield distribution
    subfield_counts, subfield_scores = analyze_subfield_distribution(papers, subfields)
    
    # Calculate average scores per subfield
    subfield_avg_scores = {}
    for subfield, scores in subfield_scores.items():
        if scores:
            subfield_avg_scores[subfield] = sum(scores) / len(scores)
    
    # Create recommendations with diversity
    recommendations = []
    used_subfields = set()
    
    # First, add top papers from each subfield
    for subfield in subfields:
        subfield_papers = [p for p in papers if subfield in p.get("subfields", [])]
        if subfield_papers:
            top_papers = sorted(subfield_papers, key=lambda p: p.get("ranking_score", 0), reverse=True)[:3]
            recommendations.extend(top_papers)
            used_subfields.add(subfield)
    
    # Then add remaining top papers to fill the list
    remaining_papers = [p for p in papers if p not in recommendations]
    recommendations.extend(remaining_papers[:top_n - len(recommendations)])
    
    return recommendations[:top_n]

def main():
    """Main function to generate and display the ranked feed."""
    config = get_user_config()
    if not config:
        return

    # Get ranking parameters from config
    ranking_config = config.get("ranking_algorithm", {"alpha": 0.4, "beta": 0.6})
    alpha = ranking_config.get("alpha", 0.4)
    beta = ranking_config.get("beta", 0.6)
    
    # Validate alpha + beta = 1
    if abs(alpha + beta - 1.0) > 0.01:
        print(f"Warning: alpha ({alpha}) + beta ({beta}) should equal 1.0")
    
    print(f"Using ranking algorithm: alpha={alpha}, beta={beta}")

    # Connect to DB and get papers
    try:
        client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client[MONGO_DB]
        
        # Extract display names from the enabled subfields
        subfield_names = [subfield["display_name"] for subfield in config["enabled_subfields"]]
        print(f"Fetching papers for subfields: {subfield_names}...")
        filtered_papers = get_filtered_papers(db, subfield_names)
        print(f"Found {len(filtered_papers)} papers.")

        if not filtered_papers:
            print("No papers found matching the specified subfields.")
            return

        # Calculate ranks with simplified algorithm
        print("Calculating ranks using simplified algorithm...")
        ranked_papers = calculate_ranks(filtered_papers, alpha, beta)

        # Generate recommendations
        recommendations = generate_recommendations(ranked_papers, subfield_names)

        # Display results
        print(f"\n=== VERGE PIPELINE RECOMMENDATIONS ===")
        print(f"Generated {len(recommendations)} recommendations from {len(ranked_papers)} papers")
        print(f"Subfields: {', '.join(subfield_names)}")
        print(f"Algorithm: alpha={alpha}, beta={beta}")
        print("=" * 60)
        
        for i, paper in enumerate(recommendations[:20]):
            print(f"\n{i+1}. {paper.get('title', 'No title')}")
            print(f"   {paper.get('publication_date', 'Unknown date')}")
            print(f"   Citations: {paper.get('cited_by_count', 0)} | Score: {paper.get('ranking_score', 0):.3f}")
            print(f"   Journal: {paper.get('journal', 'Unknown')}")
            print(f"   Authors: {', '.join(paper.get('authors', [])[:3])}{'...' if len(paper.get('authors', [])) > 3 else ''}")
            print(f"   Subfields: {', '.join(paper.get('subfields', [])[:3])}{'...' if len(paper.get('subfields', [])) > 3 else ''}")
            if paper.get('doi'):
                print(f"   DOI: {paper.get('doi')}")
            print("-" * 40)

        # Display subfield analysis
        print(f"\n=== SUBFIELD ANALYSIS ===")
        subfield_counts, subfield_scores = analyze_subfield_distribution(ranked_papers, subfield_names)
        
        for subfield in subfield_names:
            count = subfield_counts.get(subfield, 0)
            avg_score = sum(subfield_scores.get(subfield, [0])) / len(subfield_scores.get(subfield, [1]))
            print(f"   {subfield}: {count} papers (avg score: {avg_score:.3f})")

        # Display top papers by subfield
        print(f"\n=== TOP PAPERS BY SUBFIELD ===")
        for subfield in subfield_names:
            subfield_papers = [p for p in ranked_papers if subfield in p.get("subfields", [])]
            if subfield_papers:
                top_paper = subfield_papers[0]
                print(f"\n   {subfield}:")
                print(f"      {top_paper.get('title', 'No title')}")
                print(f"      Score: {top_paper.get('ranking_score', 0):.3f} | Citations: {top_paper.get('cited_by_count', 0)}")

    except Exception as e:
        print(f"Error: Could not connect to MongoDB. {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main()
