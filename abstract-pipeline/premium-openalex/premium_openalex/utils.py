from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Tuple

from .topics import NEUROSCIENCE_TOPICS


def filter_from_updated(hours_back: int) -> Dict[str, str]:
    dt = datetime.utcnow() - timedelta(hours=hours_back)
    return {"filter": f"from_updated_date:{dt.isoformat()}"}


def filter_from_created(from_date: str) -> Dict[str, str]:
    # from_date format yyyy-mm-dd
    return {"filter": f"from_created_date:{from_date}"}


def filters_for_topics_title_abstract() -> List[Dict[str, str]]:
    filters = []
    for _, name in NEUROSCIENCE_TOPICS:
        filters.append({"filter": f"title_and_abstract.search:{name}"})
    return filters 