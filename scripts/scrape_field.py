#!/usr/bin/env python3
"""Scrape the Kentucky Derby field and write data/field.json.

Usage:
    python scripts/scrape_field.py --roster scripts/roster_2026.txt

Roster file format (one per line, # for comments):
    post,horse_name,jockey,trainer,morning_line
    1,Renegade,F. Geroux,B. Mott,6-1
    2,Commandment,I. Ortiz Jr.,T. Pletcher,5-2
    ...

For each horse the script attempts, in order:
  1. Equibase horse profile lookup (past performances + Beyer figures)
  2. Horse Racing Nation fallback (partial data; Beyers usually present)
  3. Manual-entry template — prints a JSON stub you can fill in by hand

Respects robots.txt, uses a realistic UA, and sleeps between requests.
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("[fatal] Install scraper deps:  pip install -r requirements.txt",
          file=sys.stderr)
    raise SystemExit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
OUT_FILE = DATA_DIR / "field.json"

USER_AGENT = (
    "Derby1M/0.1 (+https://derby1m.com; sharvilsaxena@gmail.com) "
    "Mozilla/5.0 (X11; Linux x86_64) research-scraper"
)
HEADERS = {"User-Agent": USER_AGENT, "Accept": "text/html"}
MIN_SLEEP, MAX_SLEEP = 2.5, 5.5


# ---------------------------------------------------------------------------
# Roster parsing
# ---------------------------------------------------------------------------

@dataclass
class RosterRow:
    post: int
    name: str
    jockey: str = ""
    trainer: str = ""
    morning_line: str = ""


def parse_roster(path: Path) -> list[RosterRow]:
    rows: list[RosterRow] = []
    for raw in path.read_text().splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 2:
            print(f"[warn] malformed roster row: {raw!r}", file=sys.stderr)
            continue
        rows.append(RosterRow(
            post=int(parts[0]),
            name=parts[1],
            jockey=parts[2] if len(parts) > 2 else "",
            trainer=parts[3] if len(parts) > 3 else "",
            morning_line=parts[4] if len(parts) > 4 else "",
        ))
    return rows


# ---------------------------------------------------------------------------
# robots.txt + polite fetch
# ---------------------------------------------------------------------------

_robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}


def _robots_for(url: str) -> urllib.robotparser.RobotFileParser:
    host = urllib.parse.urlparse(url).netloc
    if host in _robots_cache:
        return _robots_cache[host]
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(f"https://{host}/robots.txt")
    try:
        rp.read()
    except Exception:
        pass
    _robots_cache[host] = rp
    return rp


def polite_get(url: str) -> Optional[str]:
    """GET with robots.txt check, realistic UA, jittered sleep, and error swallowing."""
    rp = _robots_for(url)
    if not rp.can_fetch(USER_AGENT, url):
        print(f"[robots] blocked by robots.txt: {url}", file=sys.stderr)
        return None
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException as e:
        print(f"[fetch] {url} → {e}", file=sys.stderr)
        return None
    time.sleep(random.uniform(MIN_SLEEP, MAX_SLEEP))
    if resp.status_code != 200:
        print(f"[fetch] {url} → HTTP {resp.status_code}", file=sys.stderr)
        return None
    return resp.text


# ---------------------------------------------------------------------------
# Source adapters
# ---------------------------------------------------------------------------

def try_equibase(name: str) -> Optional[dict]:
    """Search Equibase for the horse and parse their past performances.

    Equibase frequently rate-limits automated access. On block or parse failure
    this returns None and we fall through to the next source.
    """
    slug = urllib.parse.quote(name)
    search = f"https://www.equibase.com/profiles/Results.cfm?type=Horse&searchType=HorseName&searchName={slug}"
    html = polite_get(search)
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    profile_link = soup.select_one("a[href*='/profiles/horse']")
    if not profile_link:
        return None
    profile_url = urllib.parse.urljoin(search, profile_link.get("href", ""))
    page = polite_get(profile_url)
    if not page:
        return None

    # Equibase renders Beyer figures in a table column labeled "Beyer".
    # We parse defensively — markup changes often.
    beyers: list[int] = []
    rows = BeautifulSoup(page, "lxml").select("table tr")
    for row in rows:
        cells = [c.get_text(strip=True) for c in row.find_all("td")]
        if not cells:
            continue
        for cell in cells:
            m = re.fullmatch(r"(\d{2,3})", cell)
            if m and 40 <= int(m.group(1)) <= 130:
                beyers.append(int(m.group(1)))
                break
        if len(beyers) >= 3:
            break
    if len(beyers) < 3:
        return None
    return {
        "source": "equibase",
        "beyer_last_3": beyers[:3],
    }


def try_hrn(name: str) -> Optional[dict]:
    """Horse Racing Nation fallback. Beyers sometimes shown on horse pages."""
    slug = name.lower().replace(" ", "-")
    url = f"https://www.horseracingnation.com/horse/{urllib.parse.quote(slug)}"
    html = polite_get(url)
    if not html:
        return None
    # Look for pattern: "Beyer" followed by digits.
    beyers = re.findall(r"Beyer[^\d]{0,10}(\d{2,3})", html)
    beyers = [int(b) for b in beyers if 40 <= int(b) <= 130]
    if len(beyers) < 3:
        return None
    return {
        "source": "horseracingnation",
        "beyer_last_3": beyers[:3],
    }


# ---------------------------------------------------------------------------
# Derive fields from raw data
# ---------------------------------------------------------------------------

def derive(row: RosterRow, raw: Optional[dict]) -> dict:
    """Produce a full horse dict from a roster row + (optionally) raw scraped data."""
    beyer_last_3 = (raw or {}).get("beyer_last_3")
    if not beyer_last_3:
        # We couldn't scrape. Emit a manual-entry template — the caller will be
        # prompted to fill these in by hand (or leave the horse out).
        beyer_last_3 = [0, 0, 0]
    pace_avg = float(sum(beyer_last_3) / max(len(beyer_last_3), 1))
    return {
        "id": row.name.lower().replace(" ", "-").replace("'", ""),
        "name": row.name,
        "post_position": row.post,
        "jockey": row.jockey or None,
        "trainer": row.trainer or None,
        "morning_line": row.morning_line or None,
        "beyer_last_3": beyer_last_3,
        # Running style / aptitudes must be set by a human — these are
        # trainer/handicapper judgments, not extractable from a single page.
        "running_style": "P",
        "distance_aptitude": 0.7,
        "class_rating": 6.5,
        "surface_aptitude_dirt": 0.8,
        "surface_aptitude_wet": None,
        "pace_figure_avg": pace_avg,
        "silk": {"pattern": "solid", "primary": "#B4342D", "secondary": "#EDE6D3"},
        "_source": (raw or {}).get("source", "manual"),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--roster", required=True, type=Path,
                    help="Path to roster CSV (post,name,jockey,trainer,ml)")
    ap.add_argument("--out", type=Path, default=OUT_FILE,
                    help=f"Output JSON path (default: {OUT_FILE})")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the result to stdout instead of writing")
    args = ap.parse_args()

    if not args.roster.exists():
        print(f"[fatal] roster not found: {args.roster}", file=sys.stderr)
        return 2

    roster = parse_roster(args.roster)
    print(f"[info] loaded {len(roster)} horses from {args.roster}")

    horses: list[dict] = []
    missing: list[str] = []
    for row in roster:
        print(f"\n[{row.post:>2}] {row.name}")
        raw = try_equibase(row.name)
        if not raw:
            print(f"     equibase: no data — trying HRN")
            raw = try_hrn(row.name)
        if not raw:
            print(f"     HRN: no data — marking for manual entry")
            missing.append(row.name)
        horses.append(derive(row, raw))

    payload = {
        "meta": {
            "race": "152nd Kentucky Derby",
            "date": "2026-05-02",
            "distance": "1 1/4 miles",
            "surface": "dirt",
            "updated": time.strftime("%Y-%m-%d"),
            "source": "scripts/scrape_field.py",
        },
        "horses": horses,
    }

    if missing:
        print("\n" + "=" * 60)
        print("MANUAL ENTRY REQUIRED for these horses (couldn't scrape):")
        for name in missing:
            print(f"  - {name}")
        print("\nFill their beyer_last_3, running_style, aptitudes by hand in")
        print(f"  {args.out}")
        print("before running the sanity check. DO NOT ship with zeros.")
        print("=" * 60)

    if args.dry_run:
        json.dump(payload, sys.stdout, indent=2)
        print()
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"\n[ok] wrote {args.out}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
