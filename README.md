# Derby/1M

A public Monte Carlo simulator for the 2026 Kentucky Derby. One million
simulated races per query. Display-only, no wagering, no accounts.

This README is the **operational runbook** for launch week. If the site
broke at 2:20 PM on Saturday April 25 and you have no other reference,
this is the document you read.

---

## 1 · What this is

Next.js 16 (App Router, React 19) frontend + FastAPI/NumPy Python backend.
Deployed to Vercel *and* a self-hosted Docker stack on a Hetzner VPS.
Both deployments serve the same code + same field data.

Key files to know:

| File | Role |
|---|---|
| `data/field.json` | Live 20-horse field. **Commit this after the post draw.** If absent, the app falls back to `field.example.json`. |
| `data/field.example.json` | Pre-draw placeholder. 10 contenders, clearly labeled as such on the homepage banner. |
| `data/result.json` | Race outcome. Empty until May 2 post-race. Drives `/scorecard`. |
| `data/consensus.json` | Handicapper panel. Populated by `scripts/hermes_consensus.py`. Nav link + `/consensus` page auto-show once >=3 verified entries commit. |
| `data/field.schema.json` | JSON Schema for the field file (editor autocomplete). Zod does the runtime validation in `lib/schema.ts`. |
| `api/simulate.py` | Vectorized Monte Carlo engine. All calibration constants live here + are documented in `app/methodology/page.tsx`. |
| `scripts/launch_check.sh` | The one command before tweeting. |
| `scripts/update_field.py` | Interactive post-draw data entry. |
| `scripts/verify_field.py` | Does each horse name appear on kentuckyderby.com or HRN? |
| `scripts/sanity_check.py` | 14 hard assertions + 1 soft warning about unverified horse names. |
| `scripts/test_sim.py` | Deterministic-seed invariants. |
| `scripts/hermes_consensus.py` | Batch script for the consensus page. Never auto-commits. |

---

## 2 · The 30-minute post-draw update

Post draw is Saturday 2026-04-25 at 2:15 PM EDT. Tammaro publishes the
morning line within an hour. You have until ~3:00 PM to ship the real
20-horse field.

```bash
# 0. Pull the latest code (in case someone pushed polish fixes meanwhile)
git pull

# 1. Enter the 20 horses. This prompts for name/post/trainer/jockey/ML/
#    style/beyers/aptitudes for each. Takes ~12 minutes if you already have
#    the data sheet open.
python3 scripts/update_field.py

# 2. The script writes data/field.json and auto-runs verify + sanity. If
#    everything's green you'll see:
#       READY TO DEPLOY ✓
#    If any horse shows UNVERIFIED, re-check the spelling against
#    kentuckyderby.com/horses. Accented characters often break
#    substring match even when correct.

# 3. Ship it.
git add data/field.json
git commit -m "Final 2026 Derby field — post draw"
git push

# 4. Verify the live deploy picked it up. Vercel rebuilds in ~40s.
curl -s https://derby1m.com/api/health | python3 -m json.tool
# -> "field_mode": "production"   ← confirms field.json is loaded
# -> "field_last_updated": "2026-04-25T..."

# 5. Run the full battery.
DEPLOY_URL=https://derby1m.com bash scripts/launch_check.sh
# READY FOR DERBY  ← tweet.
```

---

## 3 · The Hermes consensus script

Optional. Adds a `/consensus` page showing what 8 named handicappers
are saying, with every quote verified against its source URL. The nav
link and page are **hidden until >=3 verified entries commit** — so
running this script badly doesn't embarrass the live site.

Prereqs: one of these environment variables.

```bash
export OPENAI_API_KEY=sk-...          # cheapest; gpt-4o-mini default
# or
export HERMES_CLI=/root/.hermes/hermes-agent/hermes
# or
export HERMES_ENDPOINT=http://127.0.0.1:8801
```

Run:

```bash
python3 scripts/hermes_consensus.py                          # full run
python3 scripts/hermes_consensus.py --dry-run                # prints, no write
python3 scripts/hermes_consensus.py --only "Brian Zipse"     # one handicapper
```

Review `data/consensus.json` before committing. Every `key_quote` field
must read like something the handicapper actually said. If any quote
looks suspiciously clean or generic, treat it as hallucinated — delete
that entry (set the handicapper to `status: "unavailable"`) and re-run.

The script's verification pass re-fetches each article and confirms the
quote appears verbatim. A network hiccup can cause a legitimate entry to
be discarded; re-run for any handicapper marked unavailable for
`no_verify`.

---

## 4 · Environment variables

| Var | Where | Purpose |
|---|---|---|
| `SITE_URL` | Vercel (production + preview) | Canonical URL. Flip to `https://derby1m.com` when the custom domain goes live. Everything — OG image, share PNG watermark, sitemap.xml, robots.txt, canonical metadata — picks it up on next deploy. |
| `NEXT_PUBLIC_SITE_URL` | Vercel + client | Same value, accessible to the Twitter share button's client-side pre-filled tweet. |
| `INTERNAL_API_URL` | VPS docker-compose only | `http://api:8001`. Tells the web container to proxy `/api/simulate` to the internal FastAPI container. Do not set in Vercel. |
| `OPENAI_API_KEY` | Local shell for `hermes_consensus.py` | LLM backend fallback. Never committed. |
| `HERMES_CLI` / `HERMES_ENDPOINT` | Same | Alternative LLM backends. |
| `DEPLOY_URL` | Local shell for `launch_check.sh` | URL the script smoke-tests against. |

---

## 5 · Troubleshooting

**`sanity_check.py` fails after an update.**
Usually means a Beyer mean shifted too far. Look at the debug trace:
`DERBY_DEBUG=1 python3 -c "..."`. If a horse's effective mean landed
much higher/lower than the others, recheck their `beyer_last_3`.

**`verify_field.py` flags a horse UNVERIFIED.**
Either (a) the name has an accented character or unusual punctuation
that broke the substring match, (b) kentuckyderby.com hadn't published
that horse yet when you ran the check, or (c) the name is wrong. The
script prints a Google search URL per unverified horse — click through
and eyeball.

**Vercel deploy fails with `Invalid field data`.**
`lib/field.ts` calls `validateField(parsed)` (Zod). If your
`data/field.json` doesn't match the schema, the build throws. Common
causes: duplicate post positions, a morning-line string that isn't
`<int>-<int>`, missing `beyer_last_3`.

**`/api/simulate` returns 429 on launch day.**
Rate limit kicked in (30/min, 200/hr per IP). The frontend shows a
friendly "too many requests" message. If this is a real spike and not
abuse, bump the constants in `api/simulate.py`
(`RATE_LIMIT_MINUTE` / `RATE_LIMIT_HOUR`) and redeploy. No state
persists across cold starts.

**`/consensus` returns 404 even after I committed consensus.json.**
Check the file has `>=3` entries where `status` is `"verified"`. The
auto-show threshold is in `lib/consensus.ts` (`MIN_VERIFIED_FOR_PUBLIC`).

**VPS deploy falls out of sync with Vercel.**
Run on the VPS:

```bash
ssh root@5.78.199.70 'cd /opt/derby1m && git pull && docker compose up -d --build'
```

---

## 6 · Launch-day checklist

Run top-to-bottom on Saturday April 25.

1. [ ] Pull the latest `main` locally and on the VPS.
2. [ ] `python3 scripts/update_field.py` (enters the 20 horses, writes `data/field.json`).
3. [ ] Eyeball the generated `data/field.json` — post positions 1–20, no duplicates, MLs look sane.
4. [ ] `python3 scripts/verify_field.py` — every horse reads LIKELY_REAL.
5. [ ] `python3 scripts/sanity_check.py` — all 14 assertions green.
6. [ ] `git add data/field.json && git commit -m 'Final field — post draw' && git push`.
7. [ ] Wait for Vercel green check (`vercel ls derby1m`).
8. [ ] `DEPLOY_URL=https://derby1m.com bash scripts/launch_check.sh` → READY FOR DERBY.
9. [ ] Open the site on your phone. Scenario controls respond. Share PNG downloads. Twitter share opens X with the current top horse.
10. [ ] Tweet. Paste the share PNG + `derby1m.com`.

---

## 7 · Post-race scorecard procedure (Sunday May 3)

```bash
# 1. Edit data/result.json with the finish order.
$EDITOR data/result.json
```

```json
{
  "meta": {
    "race": "152nd Kentucky Derby",
    "date": "2026-05-02",
    "track": "fast",
    "pace": "honest",
    "final_time": "2:02.1",
    "status": "official",
    "note": "[optional 1–3 sentence writeup shown on the scorecard page]"
  },
  "finish_order": [
    { "position": 1, "horse_id": "winning-horse-slug" },
    { "position": 2, "horse_id": "runner-up-slug" }
  ]
}
```

```bash
git add data/result.json
git commit -m "2026 Kentucky Derby — official finish order"
git push
```

`/scorecard` auto-activates: model's pre-race P(win) next to the actual
finish order, Brier score + log-loss for the model and the morning line,
and the `note` writeup. If the model lost to the morning line, the
scorecard says so plainly.

---

## 8 · Custom domain flip

When you point `derby1m.com` DNS at Vercel:

1. Add the domain in the Vercel dashboard (Project → Settings → Domains).
2. Set `SITE_URL=https://derby1m.com` **and** `NEXT_PUBLIC_SITE_URL=https://derby1m.com` in Environment Variables (production scope).
3. Redeploy. OG images, canonical metadata, sitemap, robots, share PNG watermark flip automatically.
4. (Optional) Add a 301 from `derby1m.vercel.app` → `derby1m.com` via the Vercel dashboard's Redirect rules. We don't ship this in `vercel.json` because it would also redirect preview URLs.

---

## 9 · Stack reference

```
Vercel:
  /                      /methodology           /scorecard
  /consensus             /api/simulate          /api/simulate-default
  /api/health            /api/og                /opengraph-image
  /robots.txt            /sitemap.xml

VPS (5.78.199.70):
  derby1m-web       Next.js standalone, :3000
  derby1m-api       FastAPI + NumPy, internal :8001
  derby1m-scraper   scrapling HRN scraper, 4h cycle (idle pre-draw)
  derby1m-tunnel    cloudflared HTTPS tunnel
```

All four containers live on a private bridge network `derby1m-net`;
other apps on the box (fairprice, hermes) are untouched.

---

## 10 · Local development

```bash
# One command starts both Next.js (:3000) and FastAPI (:8001).
npm run dev

# Run the unit tests:
npm test

# Full QA battery against localhost:
DEPLOY_URL=http://localhost:3000 bash scripts/launch_check.sh
```
