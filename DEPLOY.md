# Deploy — Derby/1M on Vercel

Target: public at `derby1m.com` (or `*.vercel.app`) by April 27, 2026.

## One-time setup

1. Push the repo to GitHub (public).
2. https://vercel.com/new → Import the repo.
3. Framework preset: **Next.js** (auto-detected).
4. Root directory: `./` (monorepo root).
5. Build command: `npm run build` (default).
6. Install command: `npm install` (default).
7. **Environment variables:** none required. The app has no secrets.
8. Click **Deploy**. First build takes ~2–3 min.

Vercel picks up:

- `app/**` → Next.js App Router pages.
- `api/simulate.py` → Python 3.11 serverless function (config in `vercel.json`).
- `vercel.json` → memory = 1024 MB, `maxDuration` = 30 s (Hobby max).
- `requirements.txt` → installed into the Python function environment.

After the first deploy:

```bash
curl -X POST https://<your-domain>/api/simulate \
  -H 'content-type: application/json' \
  -d '{"track":"fast","pace":"honest","beliefs":{},"iterations":200000}'
```

should return a JSON object with a `results` array of length 10 (or 20, if
`data/field.json` is populated).

## Plan considerations

- **Hobby plan:** `maxDuration` caps at 30 s. A 1,000,000-iteration sim
  over 20 horses completes in ~2–3 s on Vercel's runtime, so you have
  plenty of headroom. No need to upgrade.
- **Pro plan:** If for any reason you increase iterations above 1M or add
  bootstrap confidence intervals, bump `maxDuration` to `60` in
  `vercel.json` (Pro) or `300` (Pro with Fluid Compute).

## Post-draw update flow (April 25)

Once the post draw publishes the final 20-horse field:

```bash
# 1. Create the live roster file from scripts/roster_2026.example.txt
cp scripts/roster_2026.example.txt scripts/roster_2026.txt
$EDITOR scripts/roster_2026.txt         # fill in final 20 horses, posts, jockeys, MLs

# 2. Scrape past performances into data/field.json
python scripts/scrape_field.py --roster scripts/roster_2026.txt

# 3. Manually fix any horses the scraper couldn't complete
$EDITOR data/field.json

# 4. Sanity check the shape against the morning line
python scripts/sanity_check.py          # inspect HIGH/LOW flags, investigate

# 5. Invariants
python scripts/test_sim.py

# 6. Ship
git add data/field.json
git commit -m "Final 2026 Derby field — post draw"
git push
```

Vercel auto-redeploys on push. The site is live with the real field within
~2 minutes of the push hitting GitHub.

> `data/field.json` is in `.gitignore` by default so you don't accidentally
> commit placeholder data. Add it explicitly (`git add -f`) once you're
> comfortable with the final version.

## Race day (May 2)

After the race:

1. Edit `data/result.json`:
   ```json
   {
     "meta": {
       "race": "152nd Kentucky Derby",
       "date": "2026-05-02",
       "track": "fast",
       "pace": "honest",
       "final_time": "2:02.1",
       "status": "official"
     },
     "finish_order": [
       { "position": 1, "horse_id": "commandment" },
       { "position": 2, "horse_id": "fulleffort" },
       ...
     ]
   }
   ```
2. Commit + push.
3. `/scorecard` lights up automatically — it's a dynamic page that reads
   `data/result.json` at request time.

## Redeploy without a code change

```bash
# Via CLI
npx vercel --prod

# Or, from the Vercel dashboard: Deployments → latest → ... → Redeploy
```

## Monitoring

- **Logs:** Vercel → Project → Logs. The FastAPI function logs every
  simulate call with elapsed ms; watch for any > 8000 ms (approaching
  the hobby-plan 10-s safety margin).
- **Usage:** Derby Saturday traffic is spiky. The Python runtime is
  stateless per-invocation so horizontal scaling is automatic; cost is
  invocation-based.

## Kill switch

If you need to take the simulator offline (e.g., the scraper produced bad
data race morning):

1. Revert `data/field.json` on the default branch and push.
2. OR edit `app/page.tsx` to render a maintenance banner and comment out
   `<Simulator>`. Push.

Both paths take ~2 minutes to propagate through Vercel.
