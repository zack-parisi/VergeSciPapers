"""
Translate Mode Prompts for Eureka
Two-node pipeline: Preprocessor → Presenter
Cross-subfield translation with terminology bridges
"""

TRANSLATE_PREPROCESSOR_PROMPT = """Analyze the user's query and create a translation plan.

Return JSON:
{
  "Intent": "<user's query>",
  "UserField": "<user's field>",
  "TargetField": "<target field>",
  "KeyConcepts": ["<concepts>"],
  "RetrievalDirectives": {
    "TopK_initial": 15,
    "TopK_final": 6
  }
}

Return ONLY JSON.
"""

TRANSLATE_PRESENTER_PROMPT = """Create a translation between neuroscience fields using retrieved material.

Format:
1. **Summary of Relationship** (2-3 sentences with citations)
2. **Detailed Explanation** (3-5 paragraphs with quotes and links)
3. **Points of Divergence and Limitations** (≤2 paragraphs with citations)
4. **Referenced VergeSci Sources** (numbered list with links)

Use inline citations and quote directly from sources.
"""


def get_translate_preprocessor_prompt(user_query: str) -> str:
    """
    Returns the Translate preprocessor prompt with the user query.
    """
    return f"""{TRANSLATE_PREPROCESSOR_PROMPT}

USER QUERY:
{user_query}

Return ONLY the JSON query plan. No other text.
"""


def get_translate_presenter_prompt(user_query: str, query_plan: dict, retrieved_papers: list) -> str:
    """
    Returns the Translate presenter prompt with context.
    
    Args:
        user_query: Original user query
        query_plan: The JSON query plan from preprocessor
        retrieved_papers: List of retrieved paper documents
    """
    # Format retrieved papers for the prompt
    papers_context = []
    for i, paper in enumerate(retrieved_papers, 1):
        paper_text = f"""
Paper {i}:
- Title: {paper.get('title', 'N/A')}
- Authors: {paper.get('authors_string', 'N/A')}
- Year: {paper.get('year', 'N/A')}
- Journal: {paper.get('journal', 'N/A')}
- DOI: {paper.get('doi', 'N/A')}
- OpenAlex: {paper.get('work_id', 'N/A')}
- Abstract: {paper.get('abstract', 'N/A')}
- Subfields: {', '.join(paper.get('subfields', []))}
"""
        papers_context.append(paper_text)
    
    papers_text = "\n".join(papers_context)
    
    return f"""{TRANSLATE_PRESENTER_PROMPT}

ORIGINAL USER QUERY:
{user_query}

QUERY PLAN FROM PREPROCESSOR:
{query_plan}

RETRIEVED DOCUMENTS:
{papers_text}

Return the structured translation following the exact format specified above. Use markdown formatting for headers.
"""

