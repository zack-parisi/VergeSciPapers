#!/usr/bin/env python3
"""
Eureka CLI - VergeSci AI Research Assistant
Command-line interface for testing Search Mode and Translator Mode
"""
import sys
import json
from pathlib import Path
import click
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from search_mode import SearchMode
from quick_search_mode import QuickSearchMode
from translate_mode import TranslateMode
from update_me_mode import UpdateMeMode


console = Console()


@click.group()
def cli():
    """
    EUREKA - VergeSci AI Research Assistant
    
    Nobel-level neuroscience search powered by intelligent query preprocessing,
    vector embeddings, and rigorous RAG with zero-hallucination guarantees.
    """
    pass


@cli.command()
@click.argument('query', type=str)
@click.option('--limit', '-l', default=None, type=int, help='Number of papers to retrieve (default: 3)')
@click.option('--candidates', '-c', default=None, type=int, help='Number of candidates for vector search')
@click.option('--save', '-s', type=click.Path(), help='Save results to JSON file')
@click.option('--quiet', '-q', is_flag=True, help='Minimal output (answer only)')
def search(query, limit, candidates, save, quiet):
    """
    SEARCH MODE: Preprocessed query → Vector search → Nobel-level answer
    
    Filters (year, journal, author) are automatically extracted from natural language.
    
    Examples:
        eureka search "How does sleep affect memory consolidation?"
        eureka search "find me gut-brain axis papers from this year"
        eureka search "papers by Posner on attention from 2015 to 2020"
    """
    try:
        # Execute search (preprocessor extracts all filters automatically)
        search_mode = SearchMode()
        result = search_mode.search(
            query=query,
            num_candidates=candidates,
            limit=limit,
            verbose=not quiet
        )
        search_mode.close()
        
        # Save if requested
        if save:
            output = {
                'query': result['query'],
                'answer': result['answer'],
                'metadata': result['metadata'],
                'papers': [
                    {
                        'title': p.get('title'),
                        'authors': p.get('authors_string'),
                        'journal': p.get('journal'),
                        'year': p.get('publication_date'),
                        'doi': p.get('doi'),
                        'similarity_score': p.get('score'),
                        'abstract': p.get('abstract'),
                        'work_id': p.get('work_id'),
                        'subfields': p.get('subfields', []),
                        'cited_by_count': p.get('cited_by_count', 0),
                        'keywords': p.get('keywords', []),
                        'open_access': p.get('open_access')
                    }
                    for p in result['retrieved_papers']
                ]
            }
            Path(save).write_text(json.dumps(output, indent=2))
            console.print(f"\nResults saved to {save}", style="green")
        
        if quiet:
            console.print(result['answer'])
    
    except Exception as e:
        console.print(f"\nError: {e}", style="bold red")
        sys.exit(1)


@cli.command()
@click.argument('query', type=str)
@click.option('--limit', '-l', default=10, type=int, help='Number of papers to retrieve (default: 10)')
@click.option('--candidates', '-c', default=30, type=int, help='Number of candidates for vector search (default: 30)')
@click.option('--save', '-s', type=click.Path(), help='Save results to JSON file')
@click.option('--quiet', '-q', is_flag=True, help='Minimal output (results only)')
def quick_search(query, limit, candidates, save, quiet):
    """
    QUICK SEARCH MODE: Fast top-10 paper discovery
    
    Optimized for speed with minimal preprocessing. Returns top 10 papers
    with brief relevance notes and verbatim support.
    
    Examples:
        eureka quick-search "Astrocyte calcium signaling"
        eureka quick-search "NMDA receptor gating mechanisms" --limit 5
        eureka quick-search "papers by Buzsáki on oscillations"
    """
    try:
        quick_search_mode = QuickSearchMode()
        
        if not quiet:
            console.print(f"\nConnected to MongoDB: {quick_search_mode.mongo_client.db.name}.{quick_search_mode.mongo_client.collection.name}", style="green")
        
        result = quick_search_mode.search(
            user_query=query,
            num_candidates=candidates,
            limit=limit,
            verbose=(not quiet)
        )
        quick_search_mode.close()
        
        if not quiet:
            console.print("\n" + "="*80)
            console.print("QUICK SEARCH RESULTS", style="bold cyan")
            console.print("="*80)
            console.print(f"\nQuery: {result['query']}\n")
            
            if result['results']:
                console.print(f"Top {len(result['results'])} Papers:\n", style="bold")
                
                for i, paper in enumerate(result['results'], 1):
                    table = Table(show_header=False, box=None, padding=(0, 1))
                    table.add_column("Field", style="cyan")
                    table.add_column("Value")
                    
                    table.add_row("Rank", f"#{paper.get('rank', i)}")
                    table.add_row("Title", paper.get('title', 'N/A'))
                    table.add_row("Authors", paper.get('authors', 'N/A') if isinstance(paper.get('authors'), str) else ', '.join(paper.get('authors', [])))
                    table.add_row("Year", str(paper.get('year', 'N/A')))
                    table.add_row("Journal", paper.get('journal', 'N/A'))
                    table.add_row("Cited by", str(paper.get('cited_by_count', 'N/A')))
                    table.add_row("OpenAlex", paper.get('work_id', 'N/A'))
                    table.add_row("Relevance", paper.get('relevance_note', 'N/A'))
                    table.add_row("Support", paper.get('verbatim_support', 'N/A'))
                    table.add_row("Confidence", paper.get('confidence', 'High'))
                    
                    console.print(Panel(table, title=f"Paper {i}", border_style="blue"))
                    console.print()
            else:
                console.print("No results found.", style="yellow")
            
            if result.get('notes'):
                console.print("\nNotes:", style="bold")
                for note in result['notes']:
                    console.print(f"  - {note}")
            
            console.print("\n" + "="*80)
        
        if save:
            output = {
                'query': result['query'],
                'mode': 'quick_search',
                'results': result['results'],
                'notes': result.get('notes', [])
            }
            Path(save).write_text(json.dumps(output, indent=2))
            console.print(f"\nResults saved to {save}", style="green")
        
        if quiet and result['results']:
            for paper in result['results']:
                console.print(f"{paper.get('rank', '?')}. {paper.get('title', 'N/A')}")
    
    except Exception as e:
        console.print(f"\nError: {e}", style="bold red")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('query', type=str)
@click.option('--limit', '-l', default=12, type=int, help='Number of papers to retrieve (default: 12)')
@click.option('--candidates', '-c', default=30, type=int, help='Number of candidates for vector search (default: 30)')
@click.option('--save', '-s', type=click.Path(), help='Save results to JSON file')
@click.option('--quiet', '-q', is_flag=True, help='Minimal output (translation only)')
def translate(query, limit, candidates, save, quiet):
    """
    TRANSLATE MODE: Cross-subfield terminology bridges
    
    Translates concepts between neuroscience subfields with structured bridges.
    Returns 12 papers with Anchor→Bridge→Target translation framework.
    
    Examples:
        eureka translate "Explain optogenetics to a computational neuroscientist"
        eureka translate "How does spike timing relate to machine learning?"
        eureka translate "Connect astrocyte calcium to reinforcement learning"
    """
    try:
        translate_mode = TranslateMode()
        
        if not quiet:
            console.print(f"\nConnected to MongoDB: {translate_mode.mongo_client.db.name}.{translate_mode.mongo_client.collection.name}", style="green")
        
        result = translate_mode.search(
            user_query=query,
            num_candidates=candidates,
            limit=limit,
            verbose=(not quiet)
        )
        translate_mode.close()
        
        if not quiet:
            console.print("\n" + "="*80)
            console.print("TRANSLATION", style="bold cyan")
            console.print("="*80)
            console.print(f"\nQuery: {result['query']}\n")
            
            # Display translation
            from rich.markdown import Markdown
            console.print(Markdown(result['translation']))
            
            # Display clarifications if any
            if result.get('clarifications'):
                console.print("\nClarifications Needed:", style="bold yellow")
                for clarif in result['clarifications']:
                    console.print(f"  - {clarif}", style="yellow")
            
            # Display paper count
            console.print(f"\n{len(result['papers'])} Bridge Papers Referenced", style="bold")
            
            console.print("\n" + "="*80)
        
        if save:
            output = {
                'query': result['query'],
                'mode': 'translate',
                'translation': result['translation'],
                'papers': result['papers'],
                'clarifications': result.get('clarifications', []),
                'metadata': result.get('metadata', {})
            }
            Path(save).write_text(json.dumps(output, indent=2))
            console.print(f"\nResults saved to {save}", style="green")
        
        if quiet:
            console.print(result['translation'])
    
    except Exception as e:
        console.print(f"\nError: {e}", style="bold red")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('query', type=str)
@click.option('--limit', '-l', default=12, type=int, help='Number of papers to retrieve (default: 12)')
@click.option('--candidates', '-c', default=40, type=int, help='Number of candidates for vector search (default: 40)')
@click.option('--save', '-s', type=click.Path(), help='Save results to JSON file')
@click.option('--quiet', '-q', is_flag=True, help='Minimal output (digest only)')
def update_me(query, limit, candidates, save, quiet):
    """
    UPDATE ME MODE: Recent neuroscience updates (last 12 months)
    
    Automatically filters to papers from the last year. Returns 5-8 top findings
    with engaging digest format for staying current.
    
    Examples:
        eureka update-me "What's new in optogenetics?"
        eureka update-me "Recent advances in astrocyte research"
        eureka update-me "Latest findings on neural oscillations"
    """
    try:
        update_me_mode = UpdateMeMode()
        
        if not quiet:
            console.print(f"\nConnected to MongoDB: {update_me_mode.mongo_client.db.name}.{update_me_mode.mongo_client.collection.name}", style="green")
            console.print(f"Searching papers from the last 12 months...", style="cyan")
        
        result = update_me_mode.search(
            user_query=query,
            num_candidates=candidates,
            limit=limit,
            verbose=(not quiet)
        )
        update_me_mode.close()
        
        if not quiet:
            console.print("\n" + "="*80)
            console.print("UPDATE DIGEST", style="bold cyan")
            console.print("="*80)
            console.print(f"\nQuery: {result['query']}\n")
            
            # Display digest
            from rich.markdown import Markdown
            console.print(Markdown(result['digest']))
            
            # Display clarifications if any
            if result.get('clarifications'):
                console.print("\nClarifications Needed:", style="bold yellow")
                for clarif in result['clarifications']:
                    console.print(f"  - {clarif}", style="yellow")
            
            # Display metadata
            metadata = result.get('metadata', {})
            console.print(f"\nMetadata:", style="bold")
            console.print(f"  - Papers found: {metadata.get('num_papers', 0)}")
            console.print(f"  - Time range: {metadata.get('time_range', 'N/A')}")
            if metadata.get('core_topics'):
                console.print(f"  - Topics: {', '.join(metadata['core_topics'])}")
            
            console.print("\n" + "="*80)
        
        if save:
            output = {
                'query': result['query'],
                'mode': 'update_me',
                'digest': result['digest'],
                'papers': result['papers'],
                'clarifications': result.get('clarifications', []),
                'metadata': result.get('metadata', {})
            }
            Path(save).write_text(json.dumps(output, indent=2))
            console.print(f"\nResults saved to {save}", style="green")
        
        if quiet:
            console.print(result['digest'])
    
    except Exception as e:
        console.print(f"\nError: {e}", style="bold red")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('query', type=str)
@click.option('--save', '-s', type=click.Path(), help='Save query plan to JSON file')
def plan(query, save):
    """
    PLAN: View preprocessor output (Query Plan JSON)
    
    Shows how Eureka interprets and structures your query before searching.
    Useful for debugging and understanding filter extraction.
    
    Example:
        eureka plan "What role do astrocytes play in synaptic plasticity?"
        eureka plan "find me papers on dopamine from this year"
    """
    try:
        from preprocessor import QueryPreprocessor
        preprocessor = QueryPreprocessor()
        query_plan = preprocessor.preprocess(query, verbose=False)
        
        # Pretty print
        console.print("\n" + "="*80)
        console.print("QUERY PLAN (Preprocessor Output)", style="bold cyan")
        console.print("="*80 + "\n")
        console.print(json.dumps(query_plan, indent=2))
        
        if save:
            Path(save).write_text(json.dumps(query_plan, indent=2))
            console.print(f"\nQuery plan saved to {save}", style="green")
    
    except Exception as e:
        console.print(f"\nError: {e}", style="bold red")
        sys.exit(1)


@cli.command()
@click.option('--interactive', '-i', is_flag=True, help='Interactive mode')
def examples(interactive):
    """
    Example queries demonstrating Eureka's capabilities
    
    Shows example neuroscience queries for testing both modes
    """
    example_queries = [
        {
            "category": "Systems Neuroscience",
            "query": "How does thalamic inhibition influence cortical oscillation stability during REM sleep?",
            "mode": "search"
        },
        {
            "category": "Molecular/Cellular",
            "query": "What mechanisms underlie astrocyte-mediated modulation of synaptic transmission?",
            "mode": "search"
        },
        {
            "category": "Cross-Disciplinary",
            "query": "Compare computational models of dopamine signaling in reward prediction across cortical and subcortical circuits",
            "mode": "translate"
        },
        {
            "category": "Clinical",
            "query": "What are the neurobiological mechanisms linking sleep disruption to Alzheimer's pathology?",
            "mode": "search"
        },
        {
            "category": "Methods/Techniques",
            "query": "How do optogenetic stimulation parameters affect neural circuit mapping precision in behaving animals?",
            "mode": "search"
        },
        {
            "category": "Cross-Scale",
            "query": "Explain the relationship between molecular clock genes, circadian rhythms, and cognitive performance",
            "mode": "translate"
        }
    ]
    
    console.print("\n" + "="*80)
    console.print("EUREKA EXAMPLE QUERIES", style="bold cyan")
    console.print("="*80 + "\n")
    
    for i, example in enumerate(example_queries, 1):
        table = Table(show_header=False, box=None, padding=(0, 1))
        table.add_column("Key", style="cyan")
        table.add_column("Value")
        
        table.add_row("Category", example['category'])
        table.add_row("Mode", example['mode'].upper())
        table.add_row("Query", example['query'])
        
        console.print(Panel(table, title=f"Example {i}", border_style="blue"))
        console.print()
    
    if interactive:
        console.print("\n" + "="*80)
        choice = click.prompt("\nSelect example to run (1-6, or 0 to exit)", type=int)
        
        if 1 <= choice <= len(example_queries):
            example = example_queries[choice - 1]
            console.print(f"\nRunning example {choice} in {example['mode']} mode...\n")
            
            if example['mode'] == 'search':
                search_mode = SearchMode()
                result = search_mode.search(example['query'])
                search_mode.close()
            else:
                translator_mode = TranslatorMode()
                result = translator_mode.translate(example['query'])
                translator_mode.close()


@cli.command()
def test():
    """
    Run system tests to verify configuration and connectivity
    """
    console.print("\n" + "="*80)
    console.print("EUREKA SYSTEM TEST", style="bold cyan")
    console.print("="*80 + "\n")
    
    tests = []
    
    # Test 1: Configuration
    console.print("[1/4] Testing configuration...", style="yellow")
    try:
        from config import Config
        Config.validate()
        console.print("  Configuration valid", style="green")
        tests.append(True)
    except Exception as e:
        console.print(f"  Configuration error: {e}", style="red")
        tests.append(False)
    
    # Test 2: MongoDB connection
    console.print("[2/4] Testing MongoDB connection...", style="yellow")
    try:
        from mongo_client import MongoVectorClient
        client = MongoVectorClient()
        client.close()
        console.print("  MongoDB connected", style="green")
        tests.append(True)
    except Exception as e:
        console.print(f"  MongoDB error: {e}", style="red")
        tests.append(False)
    
    # Test 3: OpenAI embeddings
    console.print("[3/4] Testing OpenAI embeddings...", style="yellow")
    try:
        from embeddings import EmbeddingGenerator
        generator = EmbeddingGenerator()
        embedding = generator.generate_embedding("test query")
        assert len(embedding) == 1536
        console.print("  OpenAI embeddings working", style="green")
        tests.append(True)
    except Exception as e:
        console.print(f"  Embeddings error: {e}", style="red")
        tests.append(False)
    
    # Test 4: Quick search test
    console.print("[4/4] Testing vector search pipeline...", style="yellow")
    try:
        search_mode = SearchMode()
        result = search_mode.search("synaptic plasticity", limit=2, verbose=False)
        search_mode.close()
        assert result['retrieved_papers']
        console.print(f"  Vector search working ({len(result['retrieved_papers'])} papers found)", style="green")
        tests.append(True)
    except Exception as e:
        console.print(f"  Search error: {e}", style="red")
        tests.append(False)
    
    # Summary
    console.print("\n" + "="*80)
    passed = sum(tests)
    total = len(tests)
    
    if passed == total:
        console.print(f"All tests passed ({passed}/{total})", style="bold green")
        sys.exit(0)
    else:
        console.print(f"{total - passed} test(s) failed ({passed}/{total} passed)", style="bold red")
        sys.exit(1)


@cli.command()
def info():
    """
    Display system information and configuration
    """
    from config import Config
    
    table = Table(title="Eureka System Information", show_header=True)
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="white")
    
    table.add_row("MongoDB Database", Config.MONGODB_DATABASE)
    table.add_row("MongoDB Collection", Config.MONGODB_COLLECTION)
    table.add_row("Vector Index", Config.VECTOR_INDEX_NAME)
    table.add_row("Vector Model", Config.VECTOR_MODEL)
    table.add_row("Vector Dimensions", str(Config.VECTOR_DIMENSIONS))
    table.add_row("GPT Model", Config.GPT_MODEL)
    table.add_row("Temperature", str(Config.TEMPERATURE))
    table.add_row("Default Limit", str(Config.DEFAULT_LIMIT))
    table.add_row("Default Candidates", str(Config.DEFAULT_NUM_CANDIDATES))
    
    console.print("\n")
    console.print(table)
    console.print("\n")


if __name__ == '__main__':
    cli()

