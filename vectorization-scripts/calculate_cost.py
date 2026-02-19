"""
Calculate and compare costs for different embedding models
"""

import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')
DATABASE_NAME = os.getenv('DATABASE_NAME')
COLLECTION_NAME = os.getenv('COLLECTION_NAME')


def estimate_tokens(text):
    """Rough estimate: 1 token ~ 4 characters"""
    return len(text) // 4


def main():
    print("="*80)
    print("EMBEDDING COST CALCULATOR")
    print("="*80)
    print()
    
    # Connect to MongoDB
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    collection = db[COLLECTION_NAME]
    
    # Get counts
    total_papers = collection.count_documents({})
    vectorized = collection.count_documents({'vector': {'$exists': True}})
    remaining = total_papers - vectorized
    
    print(f"Total papers: {total_papers:,}")
    print(f"Already vectorized: {vectorized:,}")
    print(f"Remaining to process: {remaining:,}")
    print()
    
    # Sample papers to estimate average token count
    print("Analyzing sample papers to estimate token usage...")
    sample_size = 100
    sample_papers = list(collection.aggregate([
        {'$match': {'abstract': {'$exists': True}}},
        {'$sample': {'size': sample_size}}
    ]))
    
    token_counts = []
    for paper in sample_papers:
        text_parts = []
        if paper.get('title'):
            text_parts.append(f"Title: {paper['title']}")
        if paper.get('abstract'):
            text_parts.append(f"Abstract: {paper['abstract']}")
        if paper.get('authors_string'):
            text_parts.append(f"Authors: {paper['authors_string']}")
        elif paper.get('authors') and isinstance(paper['authors'], list):
            authors = ', '.join([a.get('name', '') for a in paper['authors'] if isinstance(a, dict)])
            if authors:
                text_parts.append(f"Authors: {authors}")
        if paper.get('journal'):
            text_parts.append(f"Journal: {paper['journal']}")
        if paper.get('keywords') and isinstance(paper['keywords'], list):
            keywords = ', '.join([str(k) for k in paper['keywords']])
            if keywords:
                text_parts.append(f"Keywords: {keywords}")
        if paper.get('subfields') and isinstance(paper['subfields'], list):
            subfields = ', '.join([str(s) for s in paper['subfields']])
            if subfields:
                text_parts.append(f"Subfields: {subfields}")
        if paper.get('mesh_terms') and isinstance(paper['mesh_terms'], list):
            mesh = ', '.join([str(m) for m in paper['mesh_terms'][:10]])
            if mesh:
                text_parts.append(f"MeSH Terms: {mesh}")
        
        full_text = ' | '.join(text_parts)
        if len(full_text) > 30000:
            full_text = full_text[:30000]
        
        tokens = estimate_tokens(full_text)
        token_counts.append(tokens)
    
    avg_tokens = sum(token_counts) / len(token_counts)
    min_tokens = min(token_counts)
    max_tokens = max(token_counts)
    
    print(f"Analyzed {sample_size} papers")
    print(f"  Average tokens per paper: {avg_tokens:.0f}")
    print(f"  Min tokens: {min_tokens:.0f}")
    print(f"  Max tokens: {max_tokens:.0f}")
    print()
    
    # Calculate costs for remaining papers
    total_tokens_remaining = remaining * avg_tokens
    total_tokens_all = total_papers * avg_tokens
    
    print("="*80)
    print("COST COMPARISON")
    print("="*80)
    print()
    
    # Pricing (as of 2024)
    models = {
        'text-embedding-3-small': {
            'price_per_1k': 0.00002,
            'dimensions': 1536,
            'description': 'Cost-effective, good quality'
        },
        'text-embedding-3-large': {
            'price_per_1k': 0.00013,
            'dimensions': 3072,
            'description': 'Higher quality, more expensive'
        },
        'text-embedding-ada-002': {
            'price_per_1k': 0.00010,
            'dimensions': 1536,
            'description': 'Legacy model (older)'
        }
    }
    
    print("FOR REMAINING PAPERS ({:,}):".format(remaining))
    print("-" * 80)
    for model_name, model_info in models.items():
        cost = (total_tokens_remaining / 1000) * model_info['price_per_1k']
        print(f"\n{model_name}:")
        print(f"  Cost: ${cost:.2f}")
        print(f"  Dimensions: {model_info['dimensions']}")
        print(f"  {model_info['description']}")
    
    print()
    print()
    print("FOR ALL PAPERS ({:,}):".format(total_papers))
    print("-" * 80)
    for model_name, model_info in models.items():
        cost = (total_tokens_all / 1000) * model_info['price_per_1k']
        print(f"\n{model_name}:")
        print(f"  Cost: ${cost:.2f}")
        print(f"  Dimensions: {model_info['dimensions']}")
        print(f"  {model_info['description']}")
    
    print()
    print()
    print("="*80)
    print("COST DIFFERENCE (small vs large)")
    print("="*80)
    
    cost_small_remaining = (total_tokens_remaining / 1000) * models['text-embedding-3-small']['price_per_1k']
    cost_large_remaining = (total_tokens_remaining / 1000) * models['text-embedding-3-large']['price_per_1k']
    cost_small_all = (total_tokens_all / 1000) * models['text-embedding-3-small']['price_per_1k']
    cost_large_all = (total_tokens_all / 1000) * models['text-embedding-3-large']['price_per_1k']
    
    print()
    print(f"Remaining papers ({remaining:,}):")
    print(f"  text-embedding-3-large costs {cost_large_remaining/cost_small_remaining:.1f}x more")
    print(f"  Difference: ${cost_large_remaining - cost_small_remaining:.2f}")
    print()
    print(f"All papers ({total_papers:,}):")
    print(f"  text-embedding-3-large costs {cost_large_all/cost_small_all:.1f}x more")
    print(f"  Difference: ${cost_large_all - cost_small_all:.2f}")
    print()
    
    print("="*80)
    print("RECOMMENDATION")
    print("="*80)
    print()
    print("USE text-embedding-3-small IF:")
    print("  - You want cost-effective solution")
    print("  - You're doing general semantic search")
    print("  - You want to iterate quickly")
    print("  - Budget is a concern")
    print()
    print("USE text-embedding-3-large IF:")
    print("  - You need maximum accuracy")
    print("  - You're doing complex similarity matching")
    print("  - You have specific quality requirements")
    print("  - Cost difference is acceptable")
    print()
    print("For most use cases, text-embedding-3-small provides excellent results")
    print("at a fraction of the cost. You can always re-vectorize later if needed.")
    print()
    
    client.close()


if __name__ == "__main__":
    main()

