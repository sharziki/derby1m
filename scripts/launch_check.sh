#!/usr/bin/env bash
# launch_check.sh — the one command before tweeting.
#
# Runs every verification the project supports. Exits non-zero on any hard
# failure. Tools that aren't installed (lighthouse, playwright) are skipped
# with a WARN — not installing them on this machine doesn't block launch.
#
# Usage:
#   DEPLOY_URL=https://derby1m.vercel.app bash scripts/launch_check.sh
#
# Env:
#   DEPLOY_URL  (required)  URL to smoke-test HTTP endpoints against
#   SKIP_REMOTE (optional)  skip curl steps (for offline runs)

set -u

DEPLOY_URL="${DEPLOY_URL:-https://derby1m.vercel.app}"
SKIP_REMOTE="${SKIP_REMOTE:-}"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

fail=0
warn=0
step=0

echo ""
echo "========================================================"
echo "Derby/1M launch check"
echo "  deploy URL : $DEPLOY_URL"
echo "  repo root  : $PROJECT_ROOT"
echo "========================================================"

run() {
  local label="$1"; shift
  step=$((step + 1))
  printf "\n── %2d · %-44s " "$step" "$label"
  if "$@" >/tmp/launch-check.$$ 2>&1; then
    echo "OK"
    return 0
  else
    echo "FAIL"
    sed 's/^/      /' /tmp/launch-check.$$
    fail=$((fail + 1))
    return 1
  fi
}

softrun() {
  # Soft-run a check: skip when the tool that matters isn't installed.
  # Usage: softrun "<label>" <tool-to-detect> -- <cmd> [args...]
  #   or:  softrun "<label>" <cmd> [args...]        (first word is the tool)
  local label="$1"; shift
  step=$((step + 1))
  printf "\n── %2d · %-44s " "$step" "$label"

  local detect
  if [ "$1" = "--detect" ]; then
    shift; detect="$1"; shift
  else
    detect="$1"
  fi

  if ! command -v "$detect" >/dev/null 2>&1; then
    echo "SKIP ($detect not installed)"
    warn=$((warn + 1))
    return 0
  fi

  if "$@" >/tmp/launch-check.$$ 2>&1; then
    echo "OK"
    return 0
  fi
  echo "FAIL"
  sed 's/^/      /' /tmp/launch-check.$$
  fail=$((fail + 1))
  return 1
}

# -------------------------------------------------------- local checks
run "npm run build (no warnings)"        npm run build
run "npm test (vitest)"                  npm test --silent -- --reporter=dot
run "python scripts/test_sim.py"         python3 scripts/test_sim.py
run "python scripts/sanity_check.py"     python3 scripts/sanity_check.py
run "python scripts/verify_field.py"     python3 scripts/verify_field.py

# -------------------------------------------------------- remote checks
if [ -z "$SKIP_REMOTE" ]; then
  run "curl /api/health"                 bash -c "curl -fsS '$DEPLOY_URL/api/health' | grep -q '\"status\":\"ok\"'"

  step=$((step + 1))
  printf "\n── %2d · %-44s " "$step" "curl /api/og (image/png)"
  ct=$(curl -fsS -o /dev/null -w "%{content_type}" "$DEPLOY_URL/api/og" 2>/dev/null)
  if [ "$ct" = "image/png" ] || [[ "$ct" == image/png* ]]; then
    echo "OK ($ct)"
  else
    echo "FAIL (content-type=$ct)"; fail=$((fail + 1))
  fi

  step=$((step + 1))
  printf "\n── %2d · %-44s " "$step" "POST /api/simulate returns results"
  count=$(curl -fsS -X POST -H 'content-type: application/json' \
    -d '{"track":"fast","pace":"honest","beliefs":{},"iterations":200000}' \
    "$DEPLOY_URL/api/simulate" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])))" 2>/dev/null || echo 0)
  if [ "${count:-0}" -gt 0 ]; then
    echo "OK (${count} horses)"
  else
    echo "FAIL (empty)"; fail=$((fail + 1))
  fi
else
  echo ""
  echo "── remote checks skipped (SKIP_REMOTE set)"
fi

# -------------------------------------------------------- soft checks
softrun "lighthouse (performance > 85)" --detect lighthouse \
  bash -c "lighthouse '$DEPLOY_URL' --only-categories=performance,accessibility \
    --chrome-flags='--headless --no-sandbox' --quiet --output=json --output-path=/tmp/lh.json \
    && python3 -c 'import json; d=json.load(open(\"/tmp/lh.json\")); perf=d[\"categories\"][\"performance\"][\"score\"]*100; a11y=d[\"categories\"][\"accessibility\"][\"score\"]*100; print(f\"perf {perf:.0f} / a11y {a11y:.0f}\"); assert perf>=85 and a11y>=95'"

# Playwright: only runs if `@playwright/test` is installed in node_modules
# AND a chromium browser is available. `npx --no-install` bails cleanly if
# the package isn't installed, which softrun treats as FAIL (not SKIP) —
# so detect via the local binary instead.
if [ -x "./node_modules/.bin/playwright" ]; then
  softrun "playwright smoke test" --detect npx \
    ./node_modules/.bin/playwright test tests/e2e.spec.ts --reporter=list
else
  step=$((step + 1))
  printf "\n── %2d · %-44s " "$step" "playwright smoke test"
  echo "SKIP (@playwright/test not installed)"
  warn=$((warn + 1))
fi

rm -f /tmp/launch-check.$$ /tmp/lh.json

# -------------------------------------------------------- summary
echo ""
echo "========================================================"
if [ "$fail" -eq 0 ]; then
  echo "🌹 READY FOR DERBY 🌹"
  [ "$warn" -gt 0 ] && echo "  ($warn soft check(s) skipped — install lighthouse/playwright to cover)"
  echo "========================================================"
  exit 0
fi

echo "✗ $fail check(s) failed"
echo "  fix above, re-run, repeat until all green."
echo "========================================================"
exit 1
