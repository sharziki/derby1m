#!/usr/bin/env python3
"""Compare model win probabilities to morning-line implied probabilities.

Runs the Monte Carlo on data/field.json (falling back to field.example.json)
under a neutral scenario, then prints a table:

    horse | model P(win) | ML P(win) | delta | flag

Flags any horse where the model disagrees violently with the morning line
(|delta| > 12 percentage points, or model < 1% while ML > 5%). Those cases
warrant manual investigation before the site goes live.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "api"))

from simulate import run_sim  # type: ignore  # noqa: E402


def ml_to_prob(ml: str | None) -> float | None:
    """Convert morning-line odds like '5-1' or '5/2' into implied probability.

    Morning line is overround and doesn't strip takeout — we're comparing
    shapes, not exact numbers.
    """
    if not ml:
        return None
    s = ml.replace("/", "-").strip()
    try:
        a, b = s.split("-")
        num, den = float(a), float(b)
    except ValueError:
        return None
    if num + den == 0:
        return None
    return den / (num + den)


def load_horses() -> list[dict]:
    real = PROJECT_ROOT / "data" / "field.json"
    example = PROJECT_ROOT / "data" / "field.example.json"
    path = real if real.exists() else example
    with path.open() as f:
        payload = json.load(f)
    return payload["horses"] if isinstance(payload, dict) else payload


def main() -> int:
    horses = load_horses()
    print(f"[sanity] using field of {len(horses)} horses")

    t0 = time.perf_counter()
    results = run_sim(
        horses,
        {"track": "fast", "pace": "honest", "beliefs": {}},
        n_iter=1_000_000,
        seed=42,
    )
    dt = (time.perf_counter() - t0) * 1000.0
    print(f"[sanity] ran 1,000,000 iter in {dt:.0f} ms")

    by_id = {h["id"]: h for h in horses}
    total_model = sum(r["p_win"] for r in results)
    print(f"[sanity] sum of P(win) = {total_model:.4f}  (expected ≈ 1.0)")

    rows = []
    for r in results:
        ml = by_id[r["id"]].get("morning_line")
        ml_p = ml_to_prob(ml)
        delta = (r["p_win"] - ml_p) * 100 if ml_p is not None else None
        flag = ""
        if ml_p is not None:
            if abs(delta) > 12:
                flag = "HIGH"
            elif r["p_win"] < 0.01 and ml_p > 0.05:
                flag = "LOW"
            elif r["p_win"] > 0.40:
                flag = "FAV"
        rows.append((r["name"], r["p_win"], ml, ml_p, delta, flag))

    # Sort by model P(win), descending
    rows.sort(key=lambda r: -r[1])

    print()
    print(f"{'HORSE':<22} {'MODEL':>8}  {'ML':>6}  {'ML_P':>7}  {'Δpp':>7}  FLAG")
    print("-" * 66)
    any_flagged = False
    for name, p, ml, ml_p, delta, flag in rows:
        p_str = f"{p*100:5.2f}%"
        ml_str = f"{ml or '-':>6}"
        ml_p_str = f"{ml_p*100:5.2f}%" if ml_p is not None else "   -  "
        delta_str = f"{delta:+6.2f}" if delta is not None else "   -  "
        print(f"{name:<22} {p_str:>8}  {ml_str}  {ml_p_str:>7}  {delta_str:>7}  {flag}")
        if flag:
            any_flagged = True

    if any_flagged:
        print("\n[sanity] flagged rows present — investigate before shipping.")
        return 1
    print("\n[sanity] no flagged rows. Model shape aligns with morning line.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
