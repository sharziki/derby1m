"""Derby/1M — Monte Carlo simulator.

Vectorized NumPy engine + FastAPI wrapper for Vercel's Python runtime.
The engine runs 1,000,000 simulated Kentucky Derbies over the full 20-horse
field in well under 10 seconds on commodity hardware. All per-iteration work
is broadcast-vectorized — no per-horse Python loops inside the sim hot path.

The engine is also importable from scripts/ via `sys.path` for sanity checks
and tests — see scripts/test_sim.py.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Literal, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

TrackCondition = Literal["fast", "good", "sloppy", "muddy"]
PaceScenario = Literal["slow", "honest", "fast"]
RunningStyle = Literal["E", "E/P", "P", "S"]


class Silk(BaseModel):
    model_config = ConfigDict(extra="ignore")
    pattern: str = "solid"
    primary: str = "#B4342D"
    secondary: str = "#EDE6D3"


class Horse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    post_position: int
    jockey: Optional[str] = None
    trainer: Optional[str] = None
    morning_line: Optional[str] = None
    beyer_last_3: list[int]
    running_style: RunningStyle
    distance_aptitude: float = Field(ge=0, le=1)
    class_rating: float = Field(ge=0, le=10)
    surface_aptitude_dirt: float = Field(ge=0, le=1)
    surface_aptitude_wet: Optional[float] = Field(default=None, ge=0, le=1)
    pace_figure_avg: float
    silk: Optional[Silk] = None


class Scenario(BaseModel):
    model_config = ConfigDict(extra="ignore")
    track: TrackCondition = "fast"
    pace: PaceScenario = "honest"
    beliefs: dict[str, float] = Field(default_factory=dict)
    iterations: int = Field(default=1_000_000, ge=1_000, le=1_000_000)
    seed: Optional[int] = None


class HorseResult(BaseModel):
    id: str
    name: str
    post_position: int
    p_win: float
    p_top3: float
    p_top4: float
    mean_finish: float
    finish_histogram: list[float]


class SimResponse(BaseModel):
    results: list[HorseResult]
    scenario: Scenario
    iterations: int
    elapsed_ms: float
    field_size: int


# ---------------------------------------------------------------------------
# Calibration constants
#
# These values are documented in the /methodology page. Changing them here
# changes the model's behavior everywhere — update the methodology copy too.
# ---------------------------------------------------------------------------

# Pace adjustment — Beyer-point shift applied additively to the horse's mean.
# Source: pace-profile studies of graded dirt routes 1950–2023 show fast paces
# shift performance ~3–6 Beyer points for front-runners vs. closers.
PACE_ADJUST: dict[str, dict[str, float]] = {
    "fast":   {"E": -4.0, "E/P": -2.0, "P":  1.5, "S":  3.5},
    "honest": {"E":  0.0, "E/P":  0.0, "P":  0.0, "S":  0.0},
    "slow":   {"E":  3.0, "E/P":  1.5, "P": -1.0, "S": -3.0},
}

# Track condition — maximum ± Beyer shift for a known wet-aptitude horse.
# Fast: no shift. Good: mild. Sloppy/Muddy: large separation.
TRACK_SHIFT_MAX: dict[str, float] = {
    "fast":   0.0,
    "good":   2.0,
    "sloppy": 8.0,
    "muddy":  7.0,
}

# Prior for unknown wet aptitude — drawn per-iteration (so uncertainty shows
# up as variance, not a fixed point estimate).
WET_PRIOR_MEAN = 0.5
WET_PRIOR_STD = 0.25

# Post-position penalty (Beyer points). Historical 1950–2023 Derby results:
# rail and far-outside posts have won substantially less than their share.
POST_PENALTY: dict[int, float] = {
    1: -1.8, 2: -1.0,
    3:  0.0, 4:  0.0, 5:  0.0, 6:  0.0, 7:  0.0, 8:  0.0,
    9:  0.0, 10: 0.0, 11: 0.0, 12: 0.0, 13: 0.0, 14: 0.0, 15: 0.0, 16: 0.0,
    17: -1.2, 18: -1.6, 19: -2.0, 20: -2.4,
}

# Per-horse Beyer std-dev floor — prevents a horse with identical last-3 figs
# from being modeled as deterministic. Set to ~5 pts so race-to-race noise
# dominates small differences in static aptitude.
MIN_BEYER_STD = 5.0

# Static-aptitude coefficients. These scale the class / distance / dirt
# aptitude fields into a Beyer-point shift. Kept deliberately modest —
# with a 5-point std on the per-horse Normal, a combined static edge larger
# than ~4 points starts producing unrealistic 50%+ favorites.
CLASS_COEF = 0.25   # Beyer pts per unit of (class_rating - 5), on a 0–10 scale
DIST_COEF = 3.5     # Beyer pts for the full 0→1 swing of distance_aptitude
DIRT_COEF = 2.5     # Beyer pts for the full 0→1 swing of surface_aptitude_dirt


# ---------------------------------------------------------------------------
# Simulation engine
# ---------------------------------------------------------------------------

def run_sim(
    horses: list[dict],
    scenario: dict,
    n_iter: int = 1_000_000,
    seed: Optional[int] = None,
) -> list[dict]:
    """Run `n_iter` simulated races and return per-horse aggregate stats.

    Implementation notes:
      * All per-iteration work is vectorized over NumPy arrays shaped
        (n_iter, n_horses). No Python loop over iterations or horses inside
        the sampling/ranking path.
      * Uses float32 for the (n_iter, n) matrix to halve memory (80 MB at
        1M × 20) while preserving ample precision for a ranking problem.
      * `argsort` is descending (highest sampled performance wins).
    """
    n = len(horses)
    if n == 0:
        return []

    rng = np.random.default_rng(seed)

    # --- Per-horse base stats ---------------------------------------------
    beyers = np.asarray([h["beyer_last_3"] for h in horses], dtype=np.float32)
    beyer_mean = beyers.mean(axis=1)                                 # (n,)
    beyer_std = np.maximum(beyers.std(axis=1, ddof=0), MIN_BEYER_STD)

    class_rating = np.asarray(
        [h.get("class_rating", 5.0) for h in horses], dtype=np.float32
    )
    dist_apt = np.asarray(
        [h.get("distance_aptitude", 0.5) for h in horses], dtype=np.float32
    )
    dirt_apt = np.asarray(
        [h.get("surface_aptitude_dirt", 0.5) for h in horses], dtype=np.float32
    )

    class_adj = (class_rating - 5.0) * CLASS_COEF
    dist_adj = (dist_apt - 0.5) * DIST_COEF
    dirt_adj = (dirt_apt - 0.5) * DIRT_COEF
    base_mean = beyer_mean + class_adj + dist_adj + dirt_adj

    # --- Scenario adjustments ---------------------------------------------
    pace = scenario.get("pace", "honest")
    pace_lookup = PACE_ADJUST.get(pace, PACE_ADJUST["honest"])
    pace_adj = np.asarray(
        [pace_lookup.get(h["running_style"], 0.0) for h in horses],
        dtype=np.float32,
    )

    post_adj = np.asarray(
        [POST_PENALTY.get(int(h["post_position"]), 0.0) for h in horses],
        dtype=np.float32,
    )

    beliefs = scenario.get("beliefs") or {}
    belief_adj = np.asarray(
        [float(beliefs.get(h["id"], 0.0)) for h in horses], dtype=np.float32
    )

    effective_mean = base_mean + pace_adj + post_adj + belief_adj

    # --- Draw the main (n_iter, n) sample matrix --------------------------
    samples = rng.normal(
        loc=effective_mean,
        scale=beyer_std,
        size=(n_iter, n),
    ).astype(np.float32, copy=False)

    # --- Track condition: add wet-aptitude shift --------------------------
    track = scenario.get("track", "fast")
    track_max = TRACK_SHIFT_MAX.get(track, 0.0)
    if track_max > 0.0:
        wet_known = np.asarray(
            [
                h.get("surface_aptitude_wet")
                if h.get("surface_aptitude_wet") is not None
                else np.nan
                for h in horses
            ],
            dtype=np.float32,
        )
        unknown_mask = np.isnan(wet_known)
        known_shift = np.where(unknown_mask, 0.0, (wet_known - 0.5) * 2.0 * track_max)
        samples = samples + known_shift[None, :]

        if unknown_mask.any():
            # Sample only the columns we need (saves memory if many horses known).
            k = int(unknown_mask.sum())
            wet_draws = np.clip(
                rng.normal(WET_PRIOR_MEAN, WET_PRIOR_STD, size=(n_iter, k)),
                0.0,
                1.0,
            ).astype(np.float32, copy=False)
            unknown_shift_cols = (wet_draws - 0.5) * 2.0 * track_max
            idx = np.where(unknown_mask)[0]
            samples[:, idx] += unknown_shift_cols

    # --- Rank: highest sampled performance finishes 1st -------------------
    # argsort ascending on negated values == descending order.
    order = np.argsort(-samples, axis=1).astype(np.int16, copy=False)  # (n_iter, n)

    # --- Aggregate per horse ----------------------------------------------
    # hist[i, k] = P(horse i finishes at position k+1)
    hist = np.zeros((n, n), dtype=np.float32)
    for k in range(n):
        counts = np.bincount(order[:, k], minlength=n)
        hist[:, k] = counts / float(n_iter)

    p_win = hist[:, 0]
    p_top3 = hist[:, :3].sum(axis=1)
    p_top4 = hist[:, :4].sum(axis=1)
    positions = np.arange(1, n + 1, dtype=np.float32)
    mean_finish = (hist * positions[None, :]).sum(axis=1)

    results = []
    for i, h in enumerate(horses):
        results.append(
            {
                "id": h["id"],
                "name": h["name"],
                "post_position": int(h["post_position"]),
                "p_win": float(p_win[i]),
                "p_top3": float(p_top3[i]),
                "p_top4": float(p_top4[i]),
                "mean_finish": float(mean_finish[i]),
                "finish_histogram": hist[i].tolist(),
            }
        )
    return results


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Derby/1M — Monte Carlo API", version="0.1.0")

# Resolve data dir relative to project root so this works both when run by
# uvicorn (cwd = project root) and by Vercel (cwd = project root).
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def load_field() -> list[dict]:
    real = DATA_DIR / "field.json"
    example = DATA_DIR / "field.example.json"
    path = real if real.exists() else example
    if not path.exists():
        raise HTTPException(500, f"No field data found at {real} or {example}")
    with path.open() as f:
        payload = json.load(f)
    horses = payload.get("horses", payload) if isinstance(payload, dict) else payload
    if not isinstance(horses, list):
        raise HTTPException(500, "Field data must be a list (or {horses: [...]})")
    return horses


@app.get("/api/health")
async def health() -> dict:
    try:
        field = load_field()
        return {"ok": True, "field_size": len(field)}
    except Exception as e:  # pragma: no cover
        raise HTTPException(500, str(e))


@app.post("/api/simulate", response_model=SimResponse)
async def simulate(scenario: Scenario) -> SimResponse:
    horses = load_field()
    start = time.perf_counter()
    results = run_sim(
        horses,
        scenario.model_dump(),
        n_iter=scenario.iterations,
        seed=scenario.seed,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return SimResponse(
        results=[HorseResult(**r) for r in results],
        scenario=scenario,
        iterations=scenario.iterations,
        elapsed_ms=elapsed_ms,
        field_size=len(horses),
    )


# Allow `python -m api.simulate` for local smoke-testing.
if __name__ == "__main__":  # pragma: no cover
    horses = load_field()
    t0 = time.perf_counter()
    res = run_sim(horses, {"track": "fast", "pace": "honest", "beliefs": {}},
                  n_iter=1_000_000, seed=42)
    print(f"ran 1M iter over {len(horses)} horses in {(time.perf_counter()-t0)*1000:.0f} ms")
    res.sort(key=lambda r: -r["p_win"])
    for r in res[:5]:
        print(f"  {r['name']:18s}  P(win)={r['p_win']*100:5.2f}%  "
              f"mean_finish={r['mean_finish']:.2f}")
