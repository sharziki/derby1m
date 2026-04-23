# derby1m-scraper

Python 3.12 + [scrapling](https://github.com/D4Vinci/Scrapling) container that
refreshes `data/field.json` with the latest Derby contender list + projected
morning-line odds from Horse Racing Nation.

## What it does

On each cycle:

1. Loads `data/field.json` (or the seed `data/field.example.json` if there is
   no live file yet). This is the **source of truth** for per-horse Beyers,
   aptitudes, class ratings, and running styles — none of that is scraped.
2. Hits HRN's candidate Derby permalinks; parses every `/horse/<slug>` anchor
   + nearby odds span with adaptive selectors.
3. For each horse that exists in **both** the scrape and the curated file,
   refreshes the `morning_line` string if it changed.
4. Logs horses that appeared in one side only — those need manual review
   (add to the curated file with real Beyer / aptitude numbers, or scratch).
5. Atomically writes `data/field.json`. On a failed or empty scrape, the
   existing file is left untouched.
6. Sleeps `SCRAPE_INTERVAL_SECONDS` (default 4h).

## Running

```bash
# loop mode (default — runs continuously, set by docker-compose)
docker compose up -d scraper

# one-shot (on-demand refresh; intended for hermes / operator triggers)
docker compose run --rm -e SCRAPE_ONCE=1 scraper
```

## Hermes trigger

Hermes (the Nous Research agent installed at `/root/.hermes/` on the VPS) can
invoke the scraper as a shell skill:

```yaml
# example hermes skill — paste into ~/.hermes/skills/refresh-derby/skill.yaml
name: refresh-derby
description: |
  Re-pull the Kentucky Derby contender list + morning-line odds from
  Horse Racing Nation and merge into derby1m's field.json. Leaves curated
  per-horse Beyer / aptitude / style fields untouched.
command: docker compose -f /opt/derby1m/docker-compose.yml run --rm -e SCRAPE_ONCE=1 scraper
```

After a refresh, the Next.js web container doesn't need a restart —
`lib/field.ts` reads `field.json` on every request at the `force-dynamic`
routes, and `force-static` pages pick up the change on the next revalidate
or rebuild.

## Current state (pre-post-draw)

Until the 2026 Kentucky Derby post draw on **April 25**, Horse Racing
Nation's 2026 Derby page does not publish official morning-line odds —
it carries Derby Trail horse links and prep-race dates (e.g. `12-13`,
`11-29`, `10-31`). Those dates intentionally fail the ML extractor
(`\d+-[125]$` regex), so every cycle logs:

```
empty scrape — no valid morning-line odds found.
Expected pre-post-draw; curated field.json left untouched.
```

On **April 25, 2026**, HRN publishes the official 20-horse field with
Nick Tammaro's morning-line odds. The same URL + same extractor should
start returning real odds — no operator action required beyond letting
the next cycle run.

If post-draw happens and the scraper still returns empty, update
`CANDIDATE_URLS` in `scraper/sources/hrn.py` to point at whatever
permalink HRN is using for the 2026 Derby entries page.

## What this scraper does NOT do

* **Does not scrape Beyer speed figures.** Beyers are DRF intellectual
  property; pulling them requires a paid DRF subscription + PP parsing. Leave
  those fields to manual curation.
* **Does not scrape running styles.** Inferring E/E-P/P/S requires pace-figure
  analysis across past performances.
* **Does not add new horses automatically.** If the scrape finds a horse not
  in the curated file, it's flagged in the log — it will NOT be silently
  inserted with placeholder stats. Add real numbers first.

## When to edit the HRN selectors

HRN reshapes its URL scheme every Derby cycle. If the logs start showing
`hrn: all candidate URLs exhausted`, open `scraper/sources/hrn.py` and update
`CANDIDATE_URLS` to point at the current 2027+ landing page. The extraction
logic (anchor text + nearby odds regex) should survive most small HTML
changes.
