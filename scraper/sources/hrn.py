"""Horse Racing Nation scraper — extracts the Derby contender list + projected
morning-line odds using scrapling.

Strategy:
  * Hit the main HRN domain (the site reshapes its URL scheme each year;
    the contender-list permalink changes, so we try a few candidates).
  * Parse anchor text + nearby odds spans with adaptive selectors so small
    HTML changes don't break the pipeline.
  * Return a normalized list of ``ContenderScrape`` records, or [] if the
    page layout we expected wasn't found. The caller is responsible for
    deciding whether to write a new field.json (never on empty scrape).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from scrapling import Fetcher

from scraper.log import get_logger

log = get_logger("hrn")

# HRN moves content around every Derby cycle. Try a few plausible landing
# pages, return the first that returns non-trivial content. Tuned to the
# 2026 cycle; for 2027+ these will likely need to be updated.
CANDIDATE_URLS = [
    "https://www.horseracingnation.com/race/2026_Kentucky_Derby",
    "https://www.horseracingnation.com/race/Kentucky_Derby",
    "https://www.horseracingnation.com/horse/road_to_the_kentucky_derby_2026",
    "https://www.horseracingnation.com/horse/road_to_the_kentucky_derby",
]

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4.1 Safari/605.1.15"
)

# Morning-line odds: "X-Y" or "X/Y" where Y ∈ {1, 2, 5}. Real MLs are
# integer fractions over small denominators (3-1, 5-2, 7-2, 9-2, 15-1,
# 6-5, etc.); dates and IDs like "10-10", "11-22", "12-20" slip through a
# looser regex.
ML_RE = re.compile(r"\b(\d{1,2})[-/]([125])\b")
# Windows to search after an anchor for an ML token. Tight enough that we
# don't accidentally pick up an ID from a different row.
ML_WINDOW_CHARS = 250


@dataclass(frozen=True)
class ContenderScrape:
    name: str
    morning_line: str | None
    source_url: str


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "unknown"


def _fetch_one(url: str):
    """Returns a tuple of (url, scrapling Response or None)."""
    try:
        resp = Fetcher(auto_match=False).get(url, headers={"User-Agent": UA})
        status = resp.status
        size = len(resp.body or "")
        log.info("hrn fetch", extra={"url": url, "status": status, "bytes": size})
        if status != 200 or size < 4096:
            return url, None
        return url, resp
    except Exception as e:  # pragma: no cover — network failures are fine, just try the next URL
        log.warning("hrn fetch error", extra={"url": url, "err": str(e)})
        return url, None


def _extract_contenders(page, source_url: str) -> list[ContenderScrape]:
    """Extract horse name + ML odds pairs from an HRN Response/Adaptor.

    Strategy: find every `<a>` tag whose href looks like a horse page link
    (typically `/horse/<slug>`), capture its text, then look for a
    morning-line odds token within a window of the raw HTML after the
    anchor. HRN tends to lay them out as
    ``<a>Name</a> … <span class="odds">7-2</span>`` or similar.
    """
    # scrapling's Response IS the adaptor — use it directly. CSS attribute
    # selector handles the "href contains /horse/" test without tripping
    # over scrapling's find_all restriction on non-string keyword args.
    anchors = page.css("a[href*='/horse/']")
    log.info("hrn anchors found", extra={"count": len(anchors)})

    # Raw HTML body for the proximity-based ML lookup below.
    html = page.body or ""

    # Build rows keyed by (anchor text, nearby ML).
    seen: dict[str, ContenderScrape] = {}
    for a in anchors:
        name = (a.text or "").strip()
        if not name or len(name) < 2 or len(name) > 60:
            continue
        if "http" in name.lower() or name.lower().startswith(("more", "view", "all")):
            continue
        # Skip non-horse links (HRN has /horse/ for stallions, stables, etc.).
        # Heuristic: horse names are title-cased and mostly letters.
        if not re.match(r"^[A-Z][A-Za-z0-9 .'&/-]{1,}$", name):
            continue

        # Look at the raw string immediately after the anchor for an ML
        # token. Narrow window avoids grabbing IDs from unrelated rows.
        idx = html.find(name)
        if idx < 0:
            continue
        tail = html[idx : idx + ML_WINDOW_CHARS]
        ml_match = ML_RE.search(tail)
        ml = f"{ml_match.group(1)}-{ml_match.group(2)}" if ml_match else None

        # Deduplicate by slug; prefer the first occurrence with an ML.
        slug = _slugify(name)
        prior = seen.get(slug)
        if prior is None or (prior.morning_line is None and ml is not None):
            seen[slug] = ContenderScrape(
                name=name, morning_line=ml, source_url=source_url
            )

    # Filter: we only trust entries that came with a plausible ML. HRN's
    # /horse/ links include sire / broodmare-sire pages in pedigree tables,
    # which clutter the list with names that aren't in the Derby field.
    # Dropping entries with no ML eliminates most of that noise.
    return [c for c in seen.values() if c.morning_line is not None]


def scrape_hrn() -> Iterable[ContenderScrape]:
    """Try the candidate URLs until one yields a recognizable contender list.

    Returns an empty iterable if none of the URLs produced a list of at least
    5 unique contender entries — the caller will skip the write in that case
    rather than smear field.json with a partial pull.
    """
    for url in CANDIDATE_URLS:
        _, resp = _fetch_one(url)
        if resp is None:
            continue
        rows = _extract_contenders(resp, url)
        if len(rows) >= 5:
            log.info(
                "hrn extracted contenders",
                extra={"url": url, "count": len(rows)},
            )
            return rows
        log.info(
            "hrn too few contenders, trying next URL",
            extra={"url": url, "count": len(rows)},
        )
    log.warning("hrn: all candidate URLs exhausted, nothing to merge")
    return []
