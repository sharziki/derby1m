"""Scraper main loop.

One cycle:
  1. Load curated field (data/field.json if present, else field.example.json).
  2. Scrape HRN for the current contender list + projected ML odds.
  3. Merge: refresh MLs for horses present in both. Log horses missing /
     newly-appearing (manual review required).
  4. Atomically write data/field.json.
  5. Sleep SCRAPE_INTERVAL_SECONDS, repeat.

Run once and exit: set SCRAPE_ONCE=1.
"""
from __future__ import annotations

import os
import sys
import time
import traceback
from pathlib import Path

from scraper.log import get_logger
from scraper.merge import load_curated, merge, write_field
from scraper.sources.hrn import scrape_hrn

log = get_logger("loop")


def run_once() -> int:
    data_dir = Path(os.environ.get("DATA_DIR", "/data"))
    out_path = Path(os.environ.get("SCRAPE_FIELD_JSON", str(data_dir / "field.json")))
    seed_path = Path(
        os.environ.get("SCRAPE_SEED_FIELD", "/app/seed-data/field.example.json")
    )

    start = time.time()
    log.info("cycle start", extra={"out": str(out_path), "seed": str(seed_path)})

    try:
        curated = load_curated(out_path, seed_path)
    except Exception as e:
        log.error("load_curated failed", extra={"err": str(e)})
        return 2

    try:
        scraped = list(scrape_hrn())
    except Exception as e:  # pragma: no cover — defensive; HRN may 5xx
        log.error("scrape exception", extra={"err": str(e), "tb": traceback.format_exc()})
        scraped = []

    if not scraped:
        # This is the common pre-post-draw state: HRN doesn't publish
        # official Derby morning-line odds until the post draw (April 25
        # for the 2026 Derby). Before that date the contender-list page
        # only carries prep-race dates like "12-13" / "11-29", which the
        # ML extractor correctly rejects. After post-draw the same code
        # path should start returning real odds — no operator action
        # required beyond letting the next cycle run.
        log.warning(
            "empty scrape — no valid morning-line odds found. "
            "Expected pre-post-draw; curated field.json left untouched.",
            extra={"elapsed_sec": round(time.time() - start, 2)},
        )
        return 1

    merged, report = merge(curated, scraped)
    write_field(out_path, merged)

    log.info(
        "cycle done",
        extra={
            "elapsed_sec": round(time.time() - start, 2),
            "updated_mls": report["updated_mls"],
            "unchanged_ml_count": report["unchanged_mls_count"],
            "missing_in_scrape": report["missing_in_scrape"],
            "new_in_scrape": report["new_in_scrape"],
        },
    )
    return 0


def main() -> None:
    once = os.environ.get("SCRAPE_ONCE", "").lower() in {"1", "true", "yes"}
    interval = int(os.environ.get("SCRAPE_INTERVAL_SECONDS", "14400"))

    if once:
        sys.exit(run_once())

    log.info("loop start", extra={"interval_sec": interval})
    while True:
        try:
            run_once()
        except Exception as e:  # pragma: no cover — don't let the loop die
            log.error("cycle crashed", extra={"err": str(e), "tb": traceback.format_exc()})
        log.info("sleeping", extra={"seconds": interval})
        time.sleep(interval)


if __name__ == "__main__":
    main()
