#!/usr/bin/env bash
# test-all.sh — run every test suite + linter in the repo.
#
# Backend must already be running on :4000 (the commercial tests are
# integration tests against the live server). If not running, this script
# auto-starts it in the background + tears down at exit.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

BASE="${BASE:-http://127.0.0.1:4000}"
EXIT_CODE=0
PASS=0
FAIL=0
LOG=/tmp/quoted-test-all.log
: > "$LOG"

run() {
  local label="$1"; shift
  printf "  %-50s " "$label"
  # Cold-start integration tests can race the backend's startup-time
  # work (audit prune, telemetry init) on the first invocation after
  # `npm run bootstrap`. One auto-retry with 2s breathing room makes
  # the suite deterministic for "extract → bootstrap → npm test" first-run.
  if "$@" >> "$LOG" 2>&1; then
    printf '\033[32m✓ pass\033[0m\n'
    PASS=$((PASS + 1))
  else
    sleep 2
    if "$@" >> "$LOG" 2>&1; then
      printf '\033[32m✓ pass\033[0m \033[2m(retry 1)\033[0m\n'
      PASS=$((PASS + 1))
    else
      printf '\033[31m✗ fail\033[0m\n'
      FAIL=$((FAIL + 1))
      EXIT_CODE=1
    fi
  fi
}

# ── Ensure backend up ──────────────────────────────────────────────────
BE_STARTED_HERE=0
if ! curl -fsS -o /dev/null "$BASE/api/health"; then
  echo "▸ Backend not running — starting in background…"
  ( cd backend/omniplug && nohup node --env-file=.env src/backend/server.js > /tmp/quoted-be-test.log 2>&1 ) &
  BE_PID=$!
  BE_STARTED_HERE=1
  # Wait up to 30s — fresh-bootstrap machines need time for bcrypt admin
  # password hashing + migration replay before the listen() resolves.
  for i in $(seq 1 30); do
    sleep 1
    curl -fsS -o /dev/null "$BASE/api/health" && break
  done
  if ! curl -fsS -o /dev/null "$BASE/api/health"; then
    echo "✗ Backend failed to start after 30s. See /tmp/quoted-be-test.log"
    exit 1
  fi
  # Warmup phase — health responds when listen() resolves, but downstream
  # routes (admin login, articles, leads) lazily prepare statements +
  # warm bcrypt + warm zod schemas on first hit. Without this warmup, the
  # OmniPlug smoke (which fires 18 requests rapid-fire) sees timing-sensitive
  # rate-limit edges on the first run after bootstrap. 3× 1s warmup curls
  # eliminate this without slowing the regular dev cycle.
  curl -fsS -o /dev/null "$BASE/api/health"; sleep 1
  curl -fsS -o /dev/null "$BASE/api/health"; sleep 1
  curl -fsS -o /dev/null "$BASE/api/health"; sleep 1
fi

cleanup() {
  if [ "$BE_STARTED_HERE" = "1" ] && [ -n "${BE_PID:-}" ]; then
    kill "$BE_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

# Clear rate-limit + auth_attempts table for clean runs.
( cd backend/omniplug && node -e "const db = (await import('./src/core/db/connection.js')).default; db.exec('DELETE FROM auth_attempts');" 2>/dev/null ) || true

echo ""
echo "▸ Lint + verify"
run "SQL pattern lint"     bash -c 'cd backend/omniplug && node scripts/check-sql-patterns.mjs'
run "Schema verifier"      bash -c 'cd backend/omniplug && node --env-file=.env scripts/verify-schema.js'

echo ""
echo "▸ Upstream OmniPlug"
run "Smoke (18 tests)"     bash -c 'cd backend/omniplug && node --env-file=.env scripts/smoke.js'
for f in backend/omniplug/tests/test-fix-*.mjs; do
  run "$(basename $f)"     node "$f"
done

echo ""
echo "▸ Quoted commercial"
# OmniPlug smoke + regression suites consume rate-limit tokens on the
# 127.0.0.1 bucket (rateLimiterIp.js is in-memory). The commercial
# tests below also POST /api/payments/checkout + /api/auth/login under
# the same IP — without a reset, they hit 429.
#
# If we started BE here, restart it to flush the in-memory rate-limit
# Map. If BE was started by the user, leave it alone — they can re-run
# this script if they hit a 429.
if [ "$BE_STARTED_HERE" = "1" ] && [ -n "${BE_PID:-}" ]; then
  kill "$BE_PID" 2>/dev/null
  ( cd backend/omniplug && nohup node --env-file=.env src/backend/server.js > /tmp/quoted-be-test.log 2>&1 ) &
  BE_PID=$!
  for i in $(seq 1 30); do
    sleep 1
    curl -fsS -o /dev/null "$BASE/api/health" && break
  done
  sleep 2
  # Reset auth_attempts again (smoke filled it)
  ( cd backend/omniplug && node -e "const db = (await import('./src/core/db/connection.js')).default; db.exec('DELETE FROM auth_attempts');" 2>/dev/null ) || true
fi

for f in backend/omniplug/tests/quoted-test-*.mjs; do
  run "$(basename $f)"     bash -c "cd backend/omniplug && node --env-file=.env tests/$(basename $f)"
done

echo ""
echo "▸ WP plugin (PHP)"
if command -v php >/dev/null; then
  run "test-license-activation.php" php wp-plugin/tests/test-license-activation.php
  for f in wp-plugin/*.php wp-plugin/includes/*.php wp-plugin/admin/*.php wp-plugin/public/*.php; do
    run "lint $(basename $f)" php -l "$f"
  done | tail -3   # the file lints are noisy; just show the last few
else
  echo "  (php not installed — skipping PHP tests)"
fi

echo ""
echo "▸ SDK"
# Same rate-limit story as commercial — fresh BE bucket
if [ "$BE_STARTED_HERE" = "1" ] && [ -n "${BE_PID:-}" ]; then
  kill "$BE_PID" 2>/dev/null
  ( cd backend/omniplug && nohup node --env-file=.env src/backend/server.js > /tmp/quoted-be-test.log 2>&1 ) &
  BE_PID=$!
  for i in $(seq 1 30); do
    sleep 1
    curl -fsS -o /dev/null "$BASE/api/health" && break
  done
  sleep 2
fi
run "smoke.test.mjs"        bash -c "cd sdk/js-client && BASE=$BASE node test/smoke.test.mjs"

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ "$EXIT_CODE" = "0" ]; then
  printf '\033[32m  %s pass, %s fail\033[0m\n' "$PASS" "$FAIL"
else
  printf '\033[31m  %s pass, %s fail — see %s\033[0m\n' "$PASS" "$FAIL" "$LOG"
fi
echo "═══════════════════════════════════════════════════════════"
exit "$EXIT_CODE"
