from datetime import datetime
from typing import Dict, List


def _safe_get(d: Dict, path: List[str], default=None):
    cur = d
    for p in path:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return default
    return cur


def _reconstruct_abstract(abstract_inverted_index: Dict) -> str:
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not abstract_inverted_index:
        return None
    
    # Create a list to hold words at their positions
    words = {}
    max_pos = 0
    
    for word, positions in abstract_inverted_index.items():
        for pos in positions:
            words[pos] = word
            max_pos = max(max_pos, pos)
    
    # Reconstruct the text
    if not words:
        return None
    
    abstract_parts = []
    for i in range(max_pos + 1):
        if i in words:
            abstract_parts.append(words[i])
    
    return ' '.join(abstract_parts)


def _authors_list(work: Dict) -> List[str]:
    authorships = work.get("authorships", [])
    names = []
    for a in authorships:
        name = _safe_get(a, ["author", "display_name"]) or _safe_get(a, ["raw_author_name"])
        if name:
            names.append(name)
    return names


def _institutions_list(work: Dict) -> List[str]:
    authorships = work.get("authorships", [])
    inst = []
    for a in authorships:
        for i in a.get("institutions", []) or []:
            dn = i.get("display_name")
            if dn:
                inst.append(dn)
    # de-dup preserve order
    seen = set()
    dedup = []
    for x in inst:
        if x not in seen:
            seen.add(x)
            dedup.append(x)
    return dedup


def _subfields(work: Dict) -> List[str]:
    concepts = work.get("concepts", []) or []
    return [c.get("display_name") for c in concepts if c.get("display_name")]


def work_to_doc(work: Dict, filter_version: str = "v1.0_robust", relevance_score: float = 0.0) -> Dict:
    work_id_url = work.get("id")  # e.g., https://openalex.org/W...
    display_name = work.get("display_name")
    doi = _safe_get(work, ["doi"])
    
    # Try to get abstract from multiple sources
    abstract = work.get("abstract")
    if not abstract:
        abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))
    
    publication_date = _safe_get(work, ["publication_date"]) or _safe_get(work, ["publication_year"])
    journal = _safe_get(work, ["primary_location", "source", "display_name"]) or _safe_get(work, ["host_venue", "display_name"])  # support both schemas
    is_oa = bool(_safe_get(work, ["open_access", "is_oa"]))

    doc = {
        "_id": f"openalex:{work_id_url}",
        "title": display_name,
        "abstract": abstract,
        "doi": doi,
        "authors": _authors_list(work),
        "institutions": _institutions_list(work),
        "publication_date": publication_date,
        "journal": journal,
        "open_access": is_oa,
        "subfields": _subfields(work),
        "cited_by_count": work.get("cited_by_count", 0),
        "work_id": work_id_url,
        "concepts_count": len(work.get("concepts", []) or []),
        "referenced_works_count": len(work.get("referenced_works", []) or []),
        "keywords": work.get("keywords", []),
        "mesh_terms": work.get("mesh", []),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "language": work.get("language") or "",
        "filter_version": filter_version,
        "processed_at": datetime.utcnow(),
        "relevance_score": relevance_score,
    }
    return doc
