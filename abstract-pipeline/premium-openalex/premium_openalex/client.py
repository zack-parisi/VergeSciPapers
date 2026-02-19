import os
import time
from typing import Dict, Generator, Optional
from urllib.parse import urlencode

import backoff
import requests
from dotenv import load_dotenv

# Load env from project root or current directory
load_dotenv()

OPENALEX_BASE_URL = "https://api.openalex.org/works"


def _auth_headers() -> Dict[str, str]:
    api_key = os.getenv("API_KEY")
    if not api_key:
        raise RuntimeError("API_KEY not set. Create .env with API_KEY=<premium-key>.")
    return {"api_key": api_key, "Accept": "application/json"}


def _should_give_up(e: Exception) -> bool:
    if isinstance(e, requests.HTTPError):
        status = e.response.status_code
        # Do not retry on 4xx except 429
        return status != 429 and 400 <= status < 500
    return False


@backoff.on_exception(
    backoff.expo,
    (requests.HTTPError, requests.ConnectionError, requests.Timeout),
    max_time=300,
    giveup=_should_give_up,
)
def _get(url: str, params: Dict[str, str]) -> requests.Response:
    resp = requests.get(url, headers=_auth_headers(), params=params, timeout=30)
    if resp.status_code == 429:
        # Honor Retry-After if provided
        retry_after = int(resp.headers.get("Retry-After", "1"))
        time.sleep(retry_after)
    resp.raise_for_status()
    return resp


def paginate(filter_params: Dict[str, str], per_page: int = 200, max_pages: Optional[int] = None) -> Generator[Dict, None, None]:
    """
    Yields pages from OpenAlex works endpoint using cursor paging.
    """
    params = dict(filter_params)
    params["per-page"] = str(per_page)
    params["cursor"] = params.get("cursor", "*")

    pages = 0
    while True:
        resp = _get(OPENALEX_BASE_URL, params)
        data = resp.json()
        results = data.get("results", [])
        if not results:
            break
        yield data

        pages += 1
        if max_pages and pages >= max_pages:
            break

        next_cursor = data.get("meta", {}).get("next_cursor")
        if not next_cursor:
            break
        params["cursor"] = next_cursor


def fetch_results(filter_params: Dict[str, str], per_page: int = 200, max_pages: Optional[int] = None) -> Generator[Dict, None, None]:
    for page in paginate(filter_params=filter_params, per_page=per_page, max_pages=max_pages):
        for work in page.get("results", []):
            yield work 