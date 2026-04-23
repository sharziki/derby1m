#!/usr/bin/env python3
"""
verify_field.py — does each horse in the field data actually appear on
kentuckyderby.com and Horse Racing Nation's Derby page?

Reports only. Never modifies data/field.json or field.example.json. Run it,
eyeball the table, manually correct anything that reads UNVERIFIED.

PRE-DRAW (before 2026-04-25) NOISE WARNING:
  Until the post draw, kentuckyderby.com has no public entries page
  (the likely URLs 301 to the home page) and HRN's 2026 Derby URL is
  an aggregated content dump — past-winner pedigrees, prep-race
  histories, contender profiles — so almost any plausible thoroughbred
  name matches. LIKELY_REAL in that window means "appears somewhere",
  not "is in the 20-horse field".

POST-DRAW:
  Both sources publish clean entries pages with only the 20 actual
  starters. At that point the substring match becomes a real signal.
  Run the script again after ~3 PM EDT on April 25 to verify the
  freshly-committed field.json.

Exit code 0 iff every horse reads LIKELY_REAL on at least one source.
Exit 1 otherwise (useful in launch_check.sh).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import httpx  # type: ignore
except ImportError:
    print("[verify] pip install httpx", file=sys.stderr)
    sys.exit(2)

PROJECT_ROOT = Path(__file__).resolve().parent.parent

SOURCES = [
    ("kentuckyderby.com", "https://www.kentuckyderby.com/horses"),
    ("HRN",               "https://www.horseracingnation.com/race/2026_Kentucky_Derby"),
]

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"


def strip_html(html: str) -> str:
    t = re.sub(r"<script.*?</script>", " ", html, flags=re.I | re.S)
    t = re.sub(r"<style.*?</style>", " ", t, flags=re.I | re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def fetch_text(url: str) -> str | None:
    try:
        r = httpx.get(url, headers={"User-Agent": UA}, timeout=15.0, follow_redirects=True)
        if r.status_code != 200:
            return None
        return strip_html(r.text)
    except Exception as e:  # pragma: no cover — bad network is OK, we just report
        print(f"[verify] fetch error {url}: {e}", file=sys.stderr)
        return None


def load_field() -> list[dict]:
    real = PROJECT_ROOT / "data" / "field.json"
    example = PROJECT_ROOT / "data" / "field.example.json"
    for p in [real, example]:
        if p.exists():
            return json.loads(p.read_text())["horses"]
    raise SystemExit("no data/field.json or field.example.json found")


def name_in(body: str, name: str) -> bool:
    return name.lower() in body.lower()


def main() -> int:
    horses = load_field()

    pages: dict[str, str | None] = {}
    print(f"[verify] fetching {len(SOURCES)} sources…")
    for label, url in SOURCES:
        body = fetch_text(url)
        pages[label] = body
        status = f"{len(body):,} chars" if body else "unreachable"
        print(f"[verify]   {label:<22} {url}  ({status})")
    print()

    header = ["HORSE"] + [s[0].upper() for s in SOURCES] + ["VERDICT"]
    col_w = [22] + [18] * len(SOURCES) + [14]
    sep = "  ".join("-" * w for w in col_w)

    def row(cols: list[str]) -> str:
        return "  ".join(c.ljust(w) for c, w in zip(cols, col_w))

    print(row(header))
    print(sep)

    unverified_horses: list[str] = []
    for h in horses:
        cells: list[str] = [h["name"]]
        hits = 0
        for label, _ in SOURCES:
            body = pages.get(label)
            if body is None:
                cells.append("(source unreachable)")
                continue
            found = name_in(body, h["name"])
            cells.append("✓" if found else "✗")
            if found:
                hits += 1
        verdict = "LIKELY_REAL" if hits >= 1 else "UNVERIFIED"
        if verdict == "UNVERIFIED":
            unverified_horses.append(h["name"])
        cells.append(verdict)
        print(row(cells))

    print()
    if unverified_horses:
        print(f"[verify] {len(unverified_horses)} horse(s) UNVERIFIED:")
        for n in unverified_horses:
            q = re.sub(r"\s+", "+", n.strip())
            print(f'  - {n}')
            print(f'    https://www.google.com/search?q=%22{q}%22+kentucky+derby+2026')
        print("\n[verify] Investigate each manually before shipping.")
        return 1

    print("[verify] ✓ every horse matched on at least one source.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
