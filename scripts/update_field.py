#!/usr/bin/env python3
"""
update_field.py — interactive post-draw field entry.

Prompts for every horse in the 20-horse field, validates against
data/field.schema.json as it goes, writes data/field.json, then runs
verify_field.py + sanity_check.py. Prints READY TO DEPLOY on success.

Use ctrl+C at any prompt to abort — nothing is written until the final
step.

Required order of entry per horse:
  1. name
  2. post_position (1..20)
  3. trainer
  4. jockey
  5. morning_line (e.g. 7-2)
  6. running_style (menu: E / E/P / P / S)
  7. beyer_last_3 (three ints, space-separated)
  8. distance_aptitude (0..1)
  9. class_rating (0..10)
  10. surface_aptitude_dirt (0..1)
  11. surface_aptitude_wet (0..1 or blank for unknown)
  12. pace_figure_avg (number)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = PROJECT_ROOT / "data" / "field.json"
SCHEMA_PATH = PROJECT_ROOT / "data" / "field.schema.json"

RUNNING_STYLES = ["E", "E/P", "P", "S"]
ML_RE = re.compile(r"^\d+-\d+$")


def prompt(label: str, *, default: str | None = None, validate=None) -> str:
    hint = f" [{default}]" if default is not None else ""
    while True:
        raw = input(f"  {label}{hint}: ").strip()
        if not raw and default is not None:
            raw = default
        if not raw:
            print("    required")
            continue
        if validate:
            err = validate(raw)
            if err:
                print(f"    ✗ {err}")
                continue
        return raw


def prompt_optional(label: str, *, validate=None) -> str | None:
    raw = input(f"  {label} (blank = none): ").strip()
    if not raw:
        return None
    if validate:
        err = validate(raw)
        if err:
            print(f"    ✗ {err} — treating as none")
            return None
    return raw


def _v_int(lo: int, hi: int):
    def inner(s: str) -> str | None:
        try:
            n = int(s)
        except ValueError:
            return f"must be an integer in [{lo},{hi}]"
        if not (lo <= n <= hi):
            return f"must be in [{lo},{hi}]"
        return None
    return inner


def _v_float(lo: float, hi: float):
    def inner(s: str) -> str | None:
        try:
            n = float(s)
        except ValueError:
            return f"must be a number in [{lo},{hi}]"
        if not (lo <= n <= hi):
            return f"must be in [{lo},{hi}]"
        return None
    return inner


def _v_ml(s: str) -> str | None:
    return None if ML_RE.match(s) else 'must look like "7-2" or "15-1"'


def _v_style(s: str) -> str | None:
    return None if s in RUNNING_STYLES else f"must be one of {RUNNING_STYLES}"


def _v_beyers(s: str) -> str | None:
    parts = s.split()
    if len(parts) != 3:
        return "three space-separated integers"
    for p in parts:
        try:
            n = int(p)
            if not (0 <= n <= 140):
                return f"{n} out of range [0..140]"
        except ValueError:
            return f"{p!r} isn't an integer"
    return None


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "unknown"


def enter_horse(i: int) -> dict:
    print(f"\n── Horse #{i} ──")
    name = prompt("name")
    post = int(prompt("post_position (1-20)", validate=_v_int(1, 20)))
    trainer = prompt("trainer")
    jockey = prompt("jockey")
    ml = prompt("morning_line (e.g. 7-2)", validate=_v_ml)
    while True:
        style = prompt(f"running_style ({'/'.join(RUNNING_STYLES)})", default="P")
        if _v_style(style) is None:
            break
        print(f"    ✗ must be one of {RUNNING_STYLES}")
    beyers_s = prompt("beyer_last_3 (three ints)", validate=_v_beyers)
    dist_apt = float(prompt("distance_aptitude (0..1)", default="0.7", validate=_v_float(0, 1)))
    class_rating = float(prompt("class_rating (0..10)", default="7.0", validate=_v_float(0, 10)))
    dirt_apt = float(prompt("surface_aptitude_dirt (0..1)", default="0.8", validate=_v_float(0, 1)))
    wet_raw = prompt_optional("surface_aptitude_wet (0..1)", validate=_v_float(0, 1))
    wet_apt = float(wet_raw) if wet_raw is not None else None
    pace_fig = float(prompt("pace_figure_avg (0+)", default="90", validate=_v_float(0, 200)))

    return {
        "id": slugify(name),
        "name": name,
        "post_position": post,
        "jockey": jockey,
        "trainer": trainer,
        "morning_line": ml,
        "beyer_last_3": [int(x) for x in beyers_s.split()],
        "running_style": style,
        "distance_aptitude": dist_apt,
        "class_rating": class_rating,
        "surface_aptitude_dirt": dirt_apt,
        "surface_aptitude_wet": wet_apt,
        "pace_figure_avg": pace_fig,
        "silk": None,
    }


def validate_against_schema(payload: dict) -> list[str]:
    """Lightweight schema check — just uses the JSON Schema as a guide for
    the invariants that matter. For full validation run the Zod side via
    `npm run build` (it validates at load time too)."""
    errs: list[str] = []
    horses = payload.get("horses") or []
    seen_ids: set[str] = set()
    seen_posts: set[int] = set()
    for h in horses:
        if h["id"] in seen_ids:
            errs.append(f"duplicate id: {h['id']}")
        if h["post_position"] in seen_posts:
            errs.append(f"duplicate post_position: {h['post_position']}")
        seen_ids.add(h["id"])
        seen_posts.add(h["post_position"])
    return errs


def main() -> int:
    print("Derby/1M — post-draw field entry")
    print(f"Writes to: {OUT_PATH}")
    print(f"Schema:    {SCHEMA_PATH}")
    n = int(prompt("How many horses? (usually 20)", default="20", validate=_v_int(1, 20)))
    meta = {
        "race": prompt("race label", default="152nd Kentucky Derby"),
        "date": prompt("race date (YYYY-MM-DD)", default="2026-05-02"),
        "distance": "1 1/4 miles",
        "surface": "dirt",
        "updated": prompt("today's date (YYYY-MM-DD)", default="2026-04-25"),
        "projected_morning_lines": False,
        "sources": ["Entered via scripts/update_field.py"],
    }
    horses = [enter_horse(i + 1) for i in range(n)]

    payload = {"meta": meta, "horses": horses}
    errs = validate_against_schema(payload)
    if errs:
        print("\n[update_field] schema invariants violated:")
        for e in errs:
            print(f"  ✗ {e}")
        print("  edit and rerun.")
        return 1

    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"\n[update_field] wrote {OUT_PATH}")

    print("[update_field] running verify_field.py…")
    v = subprocess.run([sys.executable, "scripts/verify_field.py"], cwd=PROJECT_ROOT)
    print("[update_field] running sanity_check.py…")
    s = subprocess.run([sys.executable, "scripts/sanity_check.py"], cwd=PROJECT_ROOT)

    if v.returncode == 0 and s.returncode == 0:
        print("\nREADY TO DEPLOY ✓  →  git add data/field.json && git commit -m 'Final 2026 Derby field — post draw' && git push")
        return 0
    print("\n[update_field] one of verify/sanity failed — review above.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
