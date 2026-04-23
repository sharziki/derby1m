#!/usr/bin/env python3
"""Calibration assertions for the Derby/1M Monte Carlo.

Compares the model's win probabilities against:
  (a) hard sanity bands per horse (favorites high enough, longshots not zero)
  (b) the published morning line shape
  (c) pace-shape directional checks (closers gain under fast pace, etc.)

Exits non-zero if any assertion fails. Intended to be wired into pre-deploy CI.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "api"))

from simulate import run_sim  # type: ignore  # noqa: E402

# ---------------------------------------------------------------------------
# Per-horse sanity bands. Tied to the example field; if you change the field,
# update these alongside the data so the assertion still has a clear meaning.
# ---------------------------------------------------------------------------
PER_HORSE_BANDS = {
    "renegade":     (0.12, 0.30),
    "commandment":  (0.08, 0.22),
    "further-ado":  (0.08, 0.22),
}

# Top-3 by model probability must include at least 2 of these horses.
TOP3_REQUIRED_OVERLAP = {"renegade", "commandment", "further-ado"}
TOP3_OVERLAP_MIN = 2

# Every horse must clear this floor (no degenerate zeros).
P_WIN_FLOOR = 0.02
# No horse can run away with the field at the example-field stage.
P_WIN_CEILING = 0.30

# Longshot mass: sum of P(win) for horses with morning line >= 15. Must sit
# in a band that says the model knows they're underdogs but isn't writing
# them off entirely.
LONGSHOT_BAND = (0.15, 0.40)
LONGSHOT_ML_THRESHOLD = 15.0


def ml_to_prob(ml: str | None) -> float | None:
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


def ml_to_odds_a(ml: str | None) -> float | None:
    """Return the 'a' in a-b morning line (so 15-1 → 15.0)."""
    if not ml:
        return None
    s = ml.replace("/", "-").strip()
    try:
        a, _ = s.split("-")
        return float(a)
    except ValueError:
        return None


def load_horses() -> list[dict]:
    real = PROJECT_ROOT / "data" / "field.json"
    example = PROJECT_ROOT / "data" / "field.example.json"
    path = real if real.exists() else example
    with path.open() as f:
        payload = json.load(f)
    return payload["horses"] if isinstance(payload, dict) else payload


def pwin_by_id(results: list[dict]) -> dict[str, float]:
    return {r["id"]: r["p_win"] for r in results}


def main() -> int:
    horses = load_horses()
    print(f"[sanity] using field of {len(horses)} horses\n")

    failures: list[str] = []

    # -- Honest pace baseline ------------------------------------------------
    t0 = time.perf_counter()
    res_honest = run_sim(
        horses, {"track": "fast", "pace": "honest", "beliefs": {}},
        n_iter=1_000_000, seed=42,
    )
    dt = (time.perf_counter() - t0) * 1000
    print(f"[sanity] 1M iter (fast/honest) in {dt:.0f} ms")

    p = pwin_by_id(res_honest)
    by_id = {h["id"]: h for h in horses}

    # Print the table for human eyeballing.
    print()
    print(f"{'HORSE':<22} {'MODEL':>8}  {'ML':>6}  {'ML_P':>7}  {'Δpp':>7}  FLAG")
    print("-" * 70)
    rows = []
    for r in sorted(res_honest, key=lambda r: -r["p_win"]):
        ml = by_id[r["id"]].get("morning_line")
        ml_p = ml_to_prob(ml)
        delta = (r["p_win"] - ml_p) * 100 if ml_p is not None else None
        flag = ""
        if ml_p is not None and abs(delta) > 18:
            flag = "BIG-Δ"
        rows.append((r["name"], r["p_win"], ml, ml_p, delta, flag))
        delta_str = f"{delta:+6.2f}" if delta is not None else "   -  "
        ml_p_str = f"{ml_p*100:5.2f}%" if ml_p is not None else "   -  "
        print(
            f"{r['name']:<22} {r['p_win']*100:7.2f}%  "
            f"{(ml or '-'):>6}  {ml_p_str:>7}  {delta_str:>7}  {flag}"
        )
    print()

    sum_p = sum(r["p_win"] for r in res_honest)
    print(f"[sanity] Σ P(win) = {sum_p:.4f}")

    # -- Assertion: probabilities sum to 1 -----------------------------------
    if not (0.99 <= sum_p <= 1.01):
        failures.append(f"Σ P(win) = {sum_p:.4f}, expected ∈ [0.99, 1.01]")

    # -- Per-horse bands -----------------------------------------------------
    for hid, (lo, hi) in PER_HORSE_BANDS.items():
        if hid not in p:
            failures.append(f"horse '{hid}' missing from results")
            continue
        if not (lo <= p[hid] <= hi):
            name = by_id[hid]["name"]
            failures.append(
                f"{name} P(win) = {p[hid]*100:.2f}%, expected ∈ "
                f"[{lo*100:.0f}%, {hi*100:.0f}%]"
            )

    # -- Universal floor + ceiling -------------------------------------------
    for r in res_honest:
        if r["p_win"] < P_WIN_FLOOR:
            failures.append(
                f"{r['name']} P(win) = {r['p_win']*100:.2f}% under floor "
                f"({P_WIN_FLOOR*100:.0f}%)"
            )
        if r["p_win"] > P_WIN_CEILING:
            failures.append(
                f"{r['name']} P(win) = {r['p_win']*100:.2f}% over ceiling "
                f"({P_WIN_CEILING*100:.0f}%)"
            )

    # -- Top-3 overlap with required set -------------------------------------
    top3_ids = {r["id"] for r in sorted(res_honest, key=lambda r: -r["p_win"])[:3]}
    overlap = top3_ids & TOP3_REQUIRED_OVERLAP
    if len(overlap) < TOP3_OVERLAP_MIN:
        failures.append(
            f"top-3 by model = {sorted(top3_ids)}; expected ≥ "
            f"{TOP3_OVERLAP_MIN} of {sorted(TOP3_REQUIRED_OVERLAP)}, got {sorted(overlap)}"
        )

    # -- Longshot mass -------------------------------------------------------
    longshot_mass = 0.0
    for r in res_honest:
        a = ml_to_odds_a(by_id[r["id"]].get("morning_line"))
        if a is not None and a >= LONGSHOT_ML_THRESHOLD:
            longshot_mass += r["p_win"]
    print(
        f"[sanity] longshot mass (ML ≥ {LONGSHOT_ML_THRESHOLD:.0f}): "
        f"{longshot_mass:.4f}"
    )
    if not (LONGSHOT_BAND[0] <= longshot_mass <= LONGSHOT_BAND[1]):
        failures.append(
            f"longshot mass = {longshot_mass:.3f}, expected ∈ "
            f"[{LONGSHOT_BAND[0]:.2f}, {LONGSHOT_BAND[1]:.2f}]"
        )

    # -- Honest pace: no single running style dominates ---------------------
    # Under honest pace there is no pace-driven shift. Any one style claiming
    # >50% of total P(win) mass would mean either the data is leaning hard
    # one way (fine, but worth flagging) or the model has a structural bias
    # toward that style (not fine).
    style_mass: dict[str, float] = {"E": 0.0, "E/P": 0.0, "P": 0.0, "S": 0.0}
    for r in res_honest:
        style_mass[by_id[r["id"]]["running_style"]] += r["p_win"]
    print(
        "[sanity] honest-pace P(win) by style: "
        + ", ".join(f"{k}={v*100:4.1f}%" for k, v in style_mass.items())
    )
    for style, mass in style_mass.items():
        if mass > 0.50:
            failures.append(
                f"under honest pace, style '{style}' has {mass*100:.1f}% of "
                "total P(win) mass — single style should not exceed 50%"
            )

    # -- Pace-shape directional checks ---------------------------------------
    res_fast = run_sim(
        horses, {"track": "fast", "pace": "fast", "beliefs": {}},
        n_iter=300_000, seed=42,
    )
    res_slow = run_sim(
        horses, {"track": "fast", "pace": "slow", "beliefs": {}},
        n_iter=300_000, seed=42,
    )
    p_fast = pwin_by_id(res_fast)
    p_slow = pwin_by_id(res_slow)

    # Top closer (S-style) should gain ≥ 2pp under fast pace vs honest.
    closers = [h for h in horses if h["running_style"] == "S"]
    if closers:
        top_closer = max(closers, key=lambda h: p[h["id"]])
        gain = (p_fast[top_closer["id"]] - p[top_closer["id"]]) * 100
        print(
            f"[sanity] top closer ({top_closer['name']}): "
            f"honest {p[top_closer['id']]*100:.1f}% → fast {p_fast[top_closer['id']]*100:.1f}% "
            f"(Δ {gain:+.1f}pp)"
        )
        if gain < 2.0:
            failures.append(
                f"top closer {top_closer['name']} gained only {gain:.1f}pp under "
                "fast pace (expected ≥ +2pp)"
            )

    # Top front-runner (E-style) should gain ≥ 2pp under slow pace vs honest.
    fronts = [h for h in horses if h["running_style"] == "E"]
    if fronts:
        top_front = max(fronts, key=lambda h: p[h["id"]])
        gain = (p_slow[top_front["id"]] - p[top_front["id"]]) * 100
        print(
            f"[sanity] top E-type ({top_front['name']}): "
            f"honest {p[top_front['id']]*100:.1f}% → slow {p_slow[top_front['id']]*100:.1f}% "
            f"(Δ {gain:+.1f}pp)"
        )
        if gain < 2.0:
            failures.append(
                f"top front-runner {top_front['name']} gained only {gain:.1f}pp under "
                "slow pace (expected ≥ +2pp)"
            )

    # -- Post-position shift visible but modest -----------------------------
    # Re-run the sim with every horse moved to a neutral post (5) so the
    # post-position penalty is zeroed. Compare each affected horse's P(win)
    # in the natural sim vs the neutral sim. Spec: shift should be visible
    # (≥ 0.3pp) for any horse drawn at post 1 or post 17+, but modest
    # (≤ 2.5pp) — never the dominant lever.
    horses_neutral = [{**h, "post_position": 5} for h in horses]
    res_neutral = run_sim(
        horses_neutral, {"track": "fast", "pace": "honest", "beliefs": {}},
        n_iter=300_000, seed=42,
    )
    p_neutral = pwin_by_id(res_neutral)
    affected = [h for h in horses if h["post_position"] == 1 or h["post_position"] >= 17]
    if affected:
        print()
        for h in affected:
            shift = (p[h["id"]] - p_neutral[h["id"]]) * 100
            print(
                f"[sanity] post-{h['post_position']} {h['name']}: "
                f"with-penalty {p[h['id']]*100:.2f}% vs neutral {p_neutral[h['id']]*100:.2f}% "
                f"(Δ {shift:+.2f}pp)"
            )
            if abs(shift) < 0.3:
                failures.append(
                    f"post-{h['post_position']} {h['name']}: post-position shift "
                    f"{shift:+.2f}pp is too small (expected |Δ| ≥ 0.3pp visible)"
                )
            if abs(shift) > 2.5:
                failures.append(
                    f"post-{h['post_position']} {h['name']}: post-position shift "
                    f"{shift:+.2f}pp is too large (expected |Δ| ≤ 2.5pp modest)"
                )

    # ------------------------------------------------------------------------
    print()
    if failures:
        print(f"[sanity] FAILED ({len(failures)} assertion(s)):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1

    print("[sanity] ✓ all assertions pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
