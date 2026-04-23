#!/usr/bin/env python3
"""
hermes_consensus.py — build data/consensus.json from public handicapper picks.

Batch only. Never auto-commits. The script:

  1. For each of the 8 named handicappers, asks the configured LLM to find
     their most recent 2026 Kentucky Derby article (last 14 days), fetch it,
     and extract a structured pick with at most ONE verbatim quote ≤15 words.
  2. For each returned quote, re-fetches the article URL directly and
     confirms the quote appears character-for-character (whitespace-
     normalized, case-insensitive) in the article body. Any quote that
     fails verification → the whole handicapper entry is discarded and
     logged as a hallucination check failure.
  3. Fetches r/horseracing top threads from the last 14 days via the public
     Reddit API and summarizes them.
  4. X/Twitter: only runs if X_API_BEARER is set; otherwise unavailable.
  5. Builds a consensus_ranking by counting mentions + top picks across the
     verified entries.
  6. Writes data/consensus.json (pretty-printed), prints a human-readable
     summary table to stdout, and exits 0. Does NOT `git add` or commit.

Configuration (choose ONE; checked in this order):

  HERMES_CLI=/root/.hermes/hermes-agent/hermes   # local hermes binary
  HERMES_ENDPOINT=http://127.0.0.1:8801          # hermes HTTP gateway
  OPENAI_API_KEY=sk-...                          # fallback — uses chat.completions

If none are set, the script exits non-zero with a clear setup message and
does not touch consensus.json.

Usage:
  python3 scripts/hermes_consensus.py
  python3 scripts/hermes_consensus.py --dry-run   # prints, skips write
  python3 scripts/hermes_consensus.py --only Zipse,Demling
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import re
import subprocess
import sys
import textwrap
import time
from collections import Counter
from pathlib import Path
from typing import Any, Optional

try:
    import httpx  # type: ignore
except ImportError:  # pragma: no cover
    print("[hermes] missing httpx — pip install httpx", file=sys.stderr)
    sys.exit(2)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = PROJECT_ROOT / "data" / "consensus.json"

# ---------------------------------------------------------------------------
# Expert panel — exactly matches the user's spec
# ---------------------------------------------------------------------------

EXPERTS: list[dict[str, str]] = [
    {"name": "Brian Zipse", "publication": "Horse Racing Nation",
     "query": 'Brian Zipse "Kentucky Derby" 2026 picks site:horseracingnation.com'},
    {"name": "Jody Demling", "publication": "SportsLine",
     "query": 'Jody Demling "Kentucky Derby" 2026 picks site:sportsline.com'},
    {"name": "Andy Serling", "publication": "NYRA",
     "query": 'Andy Serling "Kentucky Derby" 2026 analysis'},
    {"name": "Mike Beer", "publication": "DRF",
     "query": 'Mike Beer "Kentucky Derby" 2026 picks site:drf.com'},
    {"name": "Kevin Kilroy", "publication": "TwinSpires",
     "query": 'Kevin Kilroy "Kentucky Derby" 2026 picks site:twinspires.com'},
    {"name": "David Aragona", "publication": "DRF",
     "query": 'David Aragona "Kentucky Derby" 2026 picks site:drf.com'},
    {"name": "Ed DeRosa", "publication": "Horse Racing Nation",
     "query": 'Ed DeRosa "Kentucky Derby" 2026 site:horseracingnation.com'},
    {"name": "Nick Tammaro", "publication": "Churchill Downs (morning line)",
     "query": 'Nick Tammaro "Kentucky Derby" 2026 morning line'},
]

FRESHNESS_DAYS = 14
MAX_QUOTE_WORDS = 15

SYSTEM_PROMPT_TEMPLATE = textwrap.dedent("""
    You extract a horse-racing handicapper's 2026 Kentucky Derby pick from a
    public article. You are given the article URL, title, publication date,
    and full plain-text body.

    HARD RULES — if you cannot comply, set status="unavailable" with a
    reason instead of inventing:

    1. Never fabricate a quote. Every word inside "key_quote" MUST appear
       verbatim and contiguously in the article body I provided. If you
       cannot find a verbatim sentence ≤ {max_words} words long that
       captures the handicapper's thesis, set status="unavailable" with
       reason="no short verbatim quote available".
    2. Never attribute a pick to the handicapper unless the article
       explicitly names that horse as their pick. "Must watch" is not a
       pick. "My top pick" is.
    3. If the article date is older than {freshness_days} days or you
       cannot determine a date, set status="unavailable" with
       reason="article is stale" or reason="no date".
    4. At most one quote. At most {max_words} words. No paraphrase.
    5. top_pick must be a single horse name as printed in the article.
    6. If the handicapper explicitly fades a contender, put that name in
       "fade". Do not guess.

    Return JSON exactly of the form:
    {{
      "status": "verified" | "unavailable",
      "reason": string (required if unavailable),
      "article_title": string,
      "article_date": "YYYY-MM-DD",
      "top_pick": string,
      "other_picks": [string, ...],
      "longshot": string | null,
      "fade": string | null,
      "key_quote": string (≤ {max_words} words, verbatim)
    }}

    You do not need to rate your confidence. Be correct or return
    unavailable.
""").strip()


# ---------------------------------------------------------------------------
# LLM backend — hermes CLI, hermes HTTP, or OpenAI API
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class LLMBackend:
    kind: str        # "hermes-cli" | "hermes-http" | "openai"
    target: str      # binary path / URL / base URL
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)


def detect_backend() -> LLMBackend:
    if os.environ.get("HERMES_CLI") and Path(os.environ["HERMES_CLI"]).exists():
        return LLMBackend("hermes-cli", os.environ["HERMES_CLI"])
    if os.environ.get("HERMES_ENDPOINT"):
        return LLMBackend("hermes-http", os.environ["HERMES_ENDPOINT"].rstrip("/"))
    if os.environ.get("OPENAI_API_KEY"):
        model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        return LLMBackend(
            "openai",
            os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
            {"api_key": os.environ["OPENAI_API_KEY"], "model": model},
        )
    raise SystemExit(
        "[hermes] No LLM backend configured. Set one of:\n"
        "  HERMES_CLI=/path/to/hermes-binary\n"
        "  HERMES_ENDPOINT=http://host:port    (agent HTTP gateway)\n"
        "  OPENAI_API_KEY=sk-...               (fallback; also honors OPENAI_MODEL, OPENAI_BASE_URL)\n"
    )


def llm_json(backend: LLMBackend, system: str, user: str, *, timeout: float = 60.0) -> dict[str, Any] | None:
    """Call the configured LLM with a JSON-mode prompt, return the parsed dict
    on success or None on any failure (caller falls back to unavailable)."""
    try:
        if backend.kind == "openai":
            return _llm_openai(backend, system, user, timeout=timeout)
        if backend.kind == "hermes-cli":
            return _llm_hermes_cli(backend, system, user, timeout=timeout)
        if backend.kind == "hermes-http":
            return _llm_hermes_http(backend, system, user, timeout=timeout)
    except Exception as e:  # pragma: no cover — surface the error but keep going
        print(f"[hermes] LLM call failed ({backend.kind}): {e}", file=sys.stderr)
        return None
    return None


def _llm_openai(backend: LLMBackend, system: str, user: str, *, timeout: float) -> Optional[dict[str, Any]]:
    headers = {"Authorization": f"Bearer {backend.extra['api_key']}"}
    body = {
        "model": backend.extra["model"],
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
        "temperature": 0,
    }
    r = httpx.post(f"{backend.target}/chat/completions", json=body, headers=headers, timeout=timeout)
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def _llm_hermes_cli(backend: LLMBackend, system: str, user: str, *, timeout: float) -> Optional[dict[str, Any]]:
    # Hermes CLI expects `hermes chat --json --system <file> --prompt <file>`
    # pattern. Tune to your deployment if the flag names differ.
    sys_f = PROJECT_ROOT / "data" / ".hermes-system.tmp"
    usr_f = PROJECT_ROOT / "data" / ".hermes-user.tmp"
    try:
        sys_f.write_text(system)
        usr_f.write_text(user)
        proc = subprocess.run(
            [backend.target, "chat", "--json", "--system", str(sys_f), "--prompt", str(usr_f)],
            capture_output=True, text=True, timeout=timeout,
        )
        if proc.returncode != 0:
            print(f"[hermes-cli] rc={proc.returncode}: {proc.stderr[:300]}", file=sys.stderr)
            return None
        return json.loads(proc.stdout)
    finally:
        sys_f.unlink(missing_ok=True)
        usr_f.unlink(missing_ok=True)


def _llm_hermes_http(backend: LLMBackend, system: str, user: str, *, timeout: float) -> Optional[dict[str, Any]]:
    r = httpx.post(
        f"{backend.target}/chat/json",
        json={"system": system, "user": user, "temperature": 0},
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# Article fetch + verification
# ---------------------------------------------------------------------------

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"


def fetch_text(url: str, *, timeout: float = 20.0) -> Optional[str]:
    try:
        r = httpx.get(url, headers={"User-Agent": UA}, timeout=timeout, follow_redirects=True)
        if r.status_code != 200:
            return None
        # Strip scripts/styles; extract visible text. Good enough for quote verify.
        body = r.text
        body = re.sub(r"<script.*?</script>", " ", body, flags=re.I | re.S)
        body = re.sub(r"<style.*?</style>", " ", body, flags=re.I | re.S)
        body = re.sub(r"<[^>]+>", " ", body)
        body = re.sub(r"\s+", " ", body)
        return body.strip()
    except Exception as e:  # pragma: no cover
        print(f"[fetch] {url}: {e}", file=sys.stderr)
        return None


def _normalize_for_compare(s: str) -> str:
    # Straight + smart quotes, em/en dashes → ascii. Collapse whitespace.
    s = (
        s.replace("‘", "'").replace("’", "'")
        .replace("“", '"').replace("”", '"')
        .replace("–", "-").replace("—", "-")
    )
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


def verify_quote_in_article(quote: str, article_url: str) -> tuple[bool, str]:
    if len(quote.split()) > MAX_QUOTE_WORDS:
        return False, f"quote is {len(quote.split())} words (> {MAX_QUOTE_WORDS})"
    body = fetch_text(article_url)
    if body is None:
        return False, "could not re-fetch article"
    hay = _normalize_for_compare(body)
    needle = _normalize_for_compare(quote)
    if needle not in hay:
        return False, "quote text not found verbatim in article"
    return True, "ok"


# ---------------------------------------------------------------------------
# Per-handicapper flow
# ---------------------------------------------------------------------------

def run_for_expert(backend: LLMBackend, expert: dict[str, str]) -> dict[str, Any]:
    name = expert["name"]
    print(f"[hermes] → {name} ({expert['publication']})…", flush=True)

    # Stage 1: LLM finds candidate article URL + fetches it (we ask the model
    # to return article_url + article_date + plain-text body in one shot).
    search_user = (
        f"Find {name}'s most recent article about the 2026 Kentucky Derby. "
        f"The article MUST have been published in the last {FRESHNESS_DAYS} days. "
        f"Use this search query as a starting point: `{expert['query']}`. "
        "Return JSON: {\"status\":\"found\"|\"not_found\", \"article_url\": string, "
        "\"article_title\": string, \"article_date\": \"YYYY-MM-DD\"}. "
        "If nothing recent, status=\"not_found\"."
    )
    search_system = (
        "You search the public web for a named handicapper's latest 2026 "
        "Kentucky Derby article. You return ONLY the URL, title, and date — "
        "no extracted picks at this stage. You must not invent URLs. If you "
        "cannot produce a URL you are confident resolves to a real article, "
        "return status=not_found."
    )
    found = llm_json(backend, search_system, search_user)
    if not found or found.get("status") != "found":
        return {"name": name, "publication": expert["publication"], "status": "unavailable",
                "reason": (found or {}).get("reason", "no recent article located")}

    url = found.get("article_url") or ""
    body = fetch_text(url)
    if not body:
        return {"name": name, "publication": expert["publication"], "status": "unavailable",
                "reason": f"could not fetch {url}"}

    # Stage 2: Extract structured pick.
    system = SYSTEM_PROMPT_TEMPLATE.format(max_words=MAX_QUOTE_WORDS, freshness_days=FRESHNESS_DAYS)
    user = json.dumps({
        "handicapper": name,
        "publication": expert["publication"],
        "article_url": url,
        "article_title": found.get("article_title", ""),
        "article_date": found.get("article_date", ""),
        "article_body": body[:18000],
    })
    extracted = llm_json(backend, system, user)
    if not extracted:
        return {"name": name, "publication": expert["publication"], "status": "unavailable",
                "reason": "LLM extraction failed"}
    if extracted.get("status") == "unavailable":
        return {"name": name, "publication": expert["publication"], "status": "unavailable",
                "reason": extracted.get("reason", "LLM flagged unavailable")}

    # Stage 3: VERIFY. Second line of defense against hallucination.
    key_quote = (extracted.get("key_quote") or "").strip()
    ok, why = verify_quote_in_article(key_quote, url)
    if not ok:
        print(f"[hermes]   ✗ quote verification FAILED ({why}) — marking unavailable", flush=True)
        return {"name": name, "publication": expert["publication"], "status": "unavailable",
                "reason": f"quote failed verification: {why}"}
    print(f"[hermes]   ✓ quote verified: {key_quote[:60]!r}")

    # Article-date staleness check (defensive — the LLM should have caught it).
    try:
        article_date = dt.date.fromisoformat(extracted.get("article_date", ""))
        if (dt.date.today() - article_date).days > FRESHNESS_DAYS:
            return {"name": name, "publication": expert["publication"], "status": "unavailable",
                    "reason": f"article dated {article_date} (> {FRESHNESS_DAYS} days old)"}
    except Exception:
        return {"name": name, "publication": expert["publication"], "status": "unavailable",
                "reason": "article date malformed or missing"}

    return {
        "name": name,
        "publication": expert["publication"],
        "status": "verified",
        "article_url": url,
        "article_title": extracted.get("article_title") or found.get("article_title") or "",
        "article_date": extracted["article_date"],
        "top_pick": extracted["top_pick"],
        "other_picks": extracted.get("other_picks") or [],
        "longshot": extracted.get("longshot"),
        "fade": extracted.get("fade"),
        "key_quote": key_quote,
        "quote_verified": True,
    }


# ---------------------------------------------------------------------------
# Aggregate signals
# ---------------------------------------------------------------------------

def run_reddit(backend: LLMBackend) -> dict[str, Any]:
    print("[hermes] → r/horseracing…")
    try:
        r = httpx.get(
            "https://www.reddit.com/r/horseracing/search.json",
            params={"q": "Derby", "restrict_sr": "on", "sort": "top", "t": "week", "limit": 25},
            headers={"User-Agent": "derby1m-consensus/1.0"},
            timeout=15.0,
        )
        r.raise_for_status()
        items = r.json().get("data", {}).get("children", [])
    except Exception as e:
        return {"status": "unavailable", "reason": f"reddit API error: {e}"}
    if len(items) < 3:
        return {"status": "unavailable", "reason": "fewer than 3 relevant posts in last 7 days"}

    threads = [f"https://reddit.com{c['data']['permalink']}" for c in items[:5]]
    titles = "\n".join(f"- {c['data']['title']} ({c['data']['score']} upvotes)" for c in items[:15])
    summary_user = (
        "Summarize the r/horseracing consensus about the 2026 Kentucky Derby "
        "from these top posts (last 7 days). 2–3 sentences, concrete — name "
        "horses by name. No quotes, no fabrication. If the posts do not "
        "converge on a single view, say so.\n\n" + titles
    )
    summary_system = (
        "You summarize Reddit consensus for a horse-racing simulator. "
        "You may ONLY reference horse names you see in the post titles. "
        "Do not cite specific users. 2–3 sentences, no marketing."
    )
    s = llm_json(backend,
                 summary_system + '\nReturn JSON: {"summary": string}.',
                 summary_user)
    if not s or not s.get("summary"):
        return {"status": "unavailable", "reason": "summarization failed"}
    return {"status": "verified", "summary": s["summary"], "top_threads": threads[:2]}


def run_x_twitter(backend: LLMBackend) -> dict[str, Any]:
    if not os.environ.get("X_API_BEARER"):
        return {"status": "unavailable",
                "reason": "X_API_BEARER not configured — X signal disabled"}
    # Real X API v2 recent-search call would go here. Deliberately left as a
    # hook because public scraping of X is not reliable and requires auth
    # that's out of scope for the batch script today.
    return {"status": "unavailable",
            "reason": "X_API_BEARER present but integration not implemented in this cycle"}


# ---------------------------------------------------------------------------
# Ranking + reporting
# ---------------------------------------------------------------------------

def build_ranking(picks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mention: Counter[str] = Counter()
    top: Counter[str] = Counter()
    for p in picks:
        if p["status"] != "verified":
            continue
        if p.get("top_pick"):
            mention[p["top_pick"]] += 1
            top[p["top_pick"]] += 1
        for h in p.get("other_picks", []) or []:
            mention[h] += 1
        if p.get("longshot"):
            mention[p["longshot"]] += 1
    all_horses = sorted(
        mention.keys(),
        key=lambda h: (-top[h], -mention[h], h.lower()),
    )
    return [
        {"horse": h, "mention_count": mention[h], "top_pick_count": top[h]}
        for h in all_horses
    ]


def print_summary(out: dict[str, Any]) -> None:
    print("\n" + "=" * 66)
    print("DERBY/1M CONSENSUS — generated", out["generated_at"])
    print("=" * 66)
    verified = [p for p in out["expert_picks"] if p["status"] == "verified"]
    unavailable = [p for p in out["expert_picks"] if p["status"] != "verified"]
    print(f"  verified experts: {len(verified)} / {len(out['expert_picks'])}")
    print(f"  unavailable    : {len(unavailable)}")
    for p in verified:
        print(f"   ✓ {p['name']:<22} top={p['top_pick']:<20} \"{p['key_quote'][:44]}\"")
    for p in unavailable:
        print(f"   · {p['name']:<22} — {p['reason']}")
    print("\n  consensus ranking:")
    for r in out["consensus_ranking"][:8]:
        print(f"   {r['horse']:<22} mentions={r['mention_count']:>2}  top_picks={r['top_pick_count']:>2}")
    print("\n  aggregates:")
    for k, v in out["aggregate_signals"].items():
        print(f"   {k:<22} {v['status']}  {v.get('reason') or v.get('summary','')[:80]}")
    print("=" * 66)
    print(f"[hermes] wrote {OUT_PATH}")
    print("[hermes] review the JSON before committing. This script does NOT commit.\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print summary, skip write")
    parser.add_argument("--only", default="", help="comma-separated handicapper names to run")
    args = parser.parse_args()

    backend = detect_backend()
    print(f"[hermes] backend: {backend.kind} → {backend.target}", flush=True)

    only = [s.strip().lower() for s in args.only.split(",") if s.strip()]
    plan = [e for e in EXPERTS if not only or e["name"].lower() in only]

    picks: list[dict[str, Any]] = []
    for e in plan:
        picks.append(run_for_expert(backend, e))
        time.sleep(0.5)  # gentle rate-limit between experts

    signals = {
        "x_twitter": run_x_twitter(backend),
        "reddit_horseracing": run_reddit(backend),
    }
    ranking = build_ranking(picks)

    out = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "generator": "hermes_consensus.py v1",
        "expert_picks": picks,
        "aggregate_signals": signals,
        "consensus_ranking": ranking,
    }

    if args.dry_run:
        print(json.dumps(out, indent=2))
        return 0

    tmp = OUT_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(out, indent=2) + "\n")
    tmp.replace(OUT_PATH)
    print_summary(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
