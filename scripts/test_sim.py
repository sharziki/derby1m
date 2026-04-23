#!/usr/bin/env python3
"""Invariants for the simulation engine.

Asserts:
  1. Per-horse P(win) is in [0, 1]; sum across horses ≈ 1.
  2. No horse exceeds 50% P(win) on the example field.
  3. Results are deterministic given a fixed seed.
  4. Finish histogram for each horse sums to 1.
  5. Track/pace scenarios actually move probabilities (not a no-op).

Run:  python scripts/test_sim.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "api"))

from simulate import run_sim  # type: ignore  # noqa: E402


def load_horses() -> list[dict]:
    with (PROJECT_ROOT / "data" / "field.example.json").open() as f:
        return json.load(f)["horses"]


def approx(a: float, b: float, tol: float = 1e-9) -> bool:
    return abs(a - b) <= tol


def main() -> int:
    horses = load_horses()
    n = len(horses)
    assert n == 10, f"expected 10 example horses, got {n}"
    print(f"[test] loaded {n} example horses")

    scenario = {"track": "fast", "pace": "honest", "beliefs": {}}

    t0 = time.perf_counter()
    r1 = run_sim(horses, scenario, n_iter=200_000, seed=42)
    dt = (time.perf_counter() - t0) * 1000.0
    print(f"[test] 200k iter in {dt:.0f} ms")

    # (1) probabilities in [0,1]
    for r in r1:
        assert 0.0 <= r["p_win"] <= 1.0, r
        assert 0.0 <= r["p_top3"] <= 1.0, r
        assert 0.0 <= r["p_top4"] <= 1.0, r
    print("[test] ✓ probs in [0,1]")

    # (2) sum of P(win) ≈ 1
    total = sum(r["p_win"] for r in r1)
    assert abs(total - 1.0) < 1e-6, f"P(win) sum = {total}"
    print(f"[test] ✓ Σ P(win) = {total:.9f}")

    # (3) no horse > 50%
    max_p = max(r["p_win"] for r in r1)
    assert max_p < 0.50, f"top horse P(win)={max_p:.3f} exceeds 50% — inspect"
    print(f"[test] ✓ max P(win) = {max_p*100:.2f}%")

    # (4) histogram sums to 1 for each horse
    for r in r1:
        s = sum(r["finish_histogram"])
        assert abs(s - 1.0) < 1e-5, f"{r['name']} histogram sums to {s}"
    print("[test] ✓ per-horse finish histograms sum to 1")

    # (5) deterministic with fixed seed
    r2 = run_sim(horses, scenario, n_iter=200_000, seed=42)
    for a, b in zip(r1, r2):
        assert a["p_win"] == b["p_win"], (a, b)
        assert a["finish_histogram"] == b["finish_histogram"]
    print("[test] ✓ deterministic under fixed seed")

    # (6) scenarios move probabilities
    r_fast_pace = run_sim(
        horses, {**scenario, "pace": "fast"}, n_iter=200_000, seed=42
    )
    r_slow_pace = run_sim(
        horses, {**scenario, "pace": "slow"}, n_iter=200_000, seed=42
    )
    moved = 0
    for a, b in zip(r_fast_pace, r_slow_pace):
        if abs(a["p_win"] - b["p_win"]) > 0.005:
            moved += 1
    assert moved >= 3, f"pace scenarios barely moved probs — only {moved} horses"
    print(f"[test] ✓ pace scenarios moved {moved}/{n} horses' P(win) by > 0.5pp")

    # (7) muddy track with an unknown-wet horse still produces valid histograms
    r_muddy = run_sim(
        horses, {**scenario, "track": "muddy"}, n_iter=50_000, seed=7
    )
    for r in r_muddy:
        assert abs(sum(r["finish_histogram"]) - 1.0) < 1e-5
    print("[test] ✓ muddy track produces valid histograms (incl. unknown-wet horses)")

    print("\n[test] all invariants pass.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
