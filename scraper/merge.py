"""Merge scraped contenders into the curated field.json.

Strategy:
  * The curated file (seed or prior field.json) is the source of truth for
    per-horse Beyers / aptitudes / running style — those can't be scraped
    cleanly from any free source and require manual curation.
  * The scraper only *refreshes* the morning-line odds for horses that
    exist in both the curated file and the scrape.
  * If the scraped set has horses not in the curated file, they're logged
    but NOT auto-added — they need manual stat curation first.
  * If the scraped set is empty or malformed, the existing file is left
    untouched. We never ship an empty or partial list to production.
"""
from __future__ import annotations

import copy
import json
import re
import time
from pathlib import Path
from typing import Any

from scraper.log import get_logger
from scraper.sources.hrn import ContenderScrape, _slugify

log = get_logger("merge")


def _today() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def load_curated(primary: Path, fallback: Path) -> dict[str, Any]:
    for p in [primary, fallback]:
        if p.exists():
            with p.open() as f:
                return json.load(f)
    raise FileNotFoundError(f"No curated field data at {primary} or {fallback}")


def merge(curated: dict[str, Any], scraped: list[ContenderScrape]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (merged_field, report). `report` summarizes what changed so the
    loop can log it and an operator can eyeball what moved."""
    out = copy.deepcopy(curated)
    horses = out.get("horses", [])
    by_slug = {h["id"]: h for h in horses}
    scraped_by_slug = {_slugify(c.name): c for c in scraped}

    updated_mls: list[dict[str, Any]] = []
    unchanged_mls: list[str] = []
    missing_in_scrape: list[str] = []
    new_in_scrape: list[dict[str, Any]] = []

    for slug, contender in scraped_by_slug.items():
        if slug not in by_slug:
            new_in_scrape.append({"name": contender.name, "morning_line": contender.morning_line})
            continue
        horse = by_slug[slug]
        prev_ml = horse.get("morning_line")
        new_ml = contender.morning_line
        if new_ml and new_ml != prev_ml:
            horse["morning_line"] = new_ml
            updated_mls.append({"name": horse["name"], "from": prev_ml, "to": new_ml})
        else:
            unchanged_mls.append(horse["name"])

    for slug, horse in by_slug.items():
        if slug not in scraped_by_slug:
            missing_in_scrape.append(horse["name"])

    # Refresh meta
    meta = out.setdefault("meta", {})
    meta["updated"] = _today()
    sources = list(meta.get("sources") or [])
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    marker = f"HRN contender list scraped {ts} by derby1m-scraper"
    # Deduplicate scraper-line entries so the sources block doesn't grow unbounded.
    sources = [s for s in sources if "derby1m-scraper" not in s]
    sources.append(marker)
    meta["sources"] = sources

    report = {
        "updated_mls": updated_mls,
        "unchanged_mls_count": len(unchanged_mls),
        "missing_in_scrape": missing_in_scrape,
        "new_in_scrape": new_in_scrape,
    }
    return out, report


def write_field(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    with tmp.open("w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    tmp.replace(path)  # atomic swap, no half-written JSON observable
    log.info("field written", extra={"path": str(path)})
