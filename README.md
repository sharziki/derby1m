# Derby/1M — Kentucky Derby Monte Carlo

One page. One million simulated Kentucky Derbies. Move the sliders, watch the
probability distribution redraw. The model is public, the math is on
`/methodology`, and the whole thing is open source.

- **Race:** 152nd Kentucky Derby — May 2, 2026
- **Post draw:** April 25, 2026
- **Ship target:** April 27

Not a wagering product. Display only. No money, no accounts, no databases.

---

## Local development

Requirements:

- Node 20+
- Python 3.11

```bash
# Node deps
npm install

# Python deps (FastAPI + NumPy + scraper libs)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start both the Next.js dev server AND the Python sim API in one command.
npm run dev
```

Open http://localhost:3000 — the simulator runs the example 10-horse field
from `data/field.example.json` until you post-draw it with real data.

### Scripts

| Command                               | What it does                                              |
| ------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                         | Runs Next.js (`:3000`) and `uvicorn` Python API (`:8001`) |
| `npm run dev:web`                     | Next.js only                                              |
| `npm run dev:api`                     | Python API only                                           |
| `npm run build`                       | Production Next.js build                                  |
| `npm run typecheck`                   | `tsc --noEmit`                                            |
| `python scripts/test_sim.py`          | Asserts sim invariants on the example field               |
| `python scripts/sanity_check.py`      | Diffs model P(win) vs. morning-line odds                  |
| `python scripts/scrape_field.py ...`  | Builds `data/field.json` (run after April 25 draw)        |

## Project layout

```
derby1m/
├── app/
│   ├── page.tsx              Main simulator
│   ├── methodology/page.tsx
│   ├── scorecard/page.tsx
│   ├── layout.tsx            Fonts, metadata, header, footer
│   └── globals.css
├── components/
│   ├── simulator.tsx         Orchestrates scenario + sim + viz
│   ├── probability-chart.tsx The signature 20-row distribution
│   ├── scenario-controls.tsx Track / pace segmented controls
│   ├── belief-stepper.tsx    ± per-horse belief override
│   ├── share-button.tsx      1080² PNG export
│   ├── share-snapshot.tsx    Off-screen layout captured for the PNG
│   ├── silk.tsx              Inline jockey-silk SVGs
│   ├── scorecard.tsx         Pre-race vs. actual comparison
│   ├── site-header.tsx
│   └── site-footer.tsx
├── lib/
│   ├── types.ts              Horse / Scenario / SimResult / ResultFile
│   ├── field.ts              Server-side JSON loaders
│   └── utils.ts              cn(), pct(), mlToProb()
├── api/
│   └── simulate.py           FastAPI + NumPy Monte Carlo (Vercel Python fn)
├── scripts/
│   ├── scrape_field.py       Equibase → HRN fallback → manual-entry stub
│   ├── sanity_check.py       Model P(win) vs. morning line
│   ├── test_sim.py           Invariants
│   └── roster_2026.example.txt
├── data/
│   ├── field.example.json    10-horse dev placeholder (committed)
│   ├── field.json            Live field (gitignored until after the draw)
│   └── result.json           Empty until May 2
├── vercel.json
├── requirements.txt
├── package.json
└── DEPLOY.md
```

## The simulation

Everything the model does is documented in depth on `/methodology`. Summary:

- Each horse has a mean performance (avg of last-3 Beyer figures) plus
  per-horse spread.
- Modifiers: pace (by running style), track condition (by wet aptitude),
  post position (rail + far-outside penalty), user belief override.
- For each of 1,000,000 iterations, every horse draws a sample from
  `N(effective_mean, std)`. The highest sample wins; `argsort` gives the
  full finish order.
- The whole pipeline is NumPy-vectorized over `(1M, 20)` arrays — no
  per-horse or per-iteration Python loops. Completes in under 10 seconds.

The sim lives in `api/simulate.py` and is importable from `scripts/` so the
sanity check and test suite use exactly the same code path as production.

## Scraper & fallbacks

`scripts/scrape_field.py` tries, in order:

1. **Equibase** horse profile → past performances → Beyer figures.
2. **Horse Racing Nation** fallback when Equibase returns 403 / empty.
3. **Manual-entry template** when both fail — the script prints which horses
   need hand-entry and writes `0` for their Beyers so the sim refuses to
   run until you edit `data/field.json` yourself. The script exits with a
   non-zero code when any horse needs manual work.

The scraper respects `robots.txt`, uses a realistic UA that identifies the
project, and sleeps 2.5–5.5s between requests.

**If Equibase rate-limits you on the day of:** run with `--dry-run` first,
then copy the partial JSON into `data/field.json` and fill in the blanks by
hand. The model refuses to run on horses with `beyer_last_3: [0,0,0]` —
`scripts/sanity_check.py` will loudly flag any zeros.

## Before deploying

```bash
python scripts/test_sim.py        # invariants must pass
python scripts/sanity_check.py    # inspect the table; no uninvestigated HIGH flags
npm run build                     # Next.js production build
```

See `DEPLOY.md` for Vercel steps.

## Credibility

This is an attention product. The credibility comes from being legible:

- Model constants live in one file (`api/simulate.py`) and are reproduced in
  the methodology page.
- Every assumption that can&apos;t be data-driven is explicit (running style
  classification, the wet-aptitude prior, post penalty coefficients).
- The model doesn&apos;t pull toward the market. Morning-line odds are
  displayed alongside, never folded in as a prior.
- The scorecard page publishes Brier score and log-loss against the
  morning line after the race. You don&apos;t get to move the goalposts.

Open an issue if you think a constant is wrong.
