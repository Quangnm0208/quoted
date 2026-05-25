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
  if "$@" >> "$LOG" 2>&1; then
    printf '\033[32m✓ pass\033[0m\n'
    PASS=$((PASS + 1))
  else
    printf '\033[31m✗ fail\033[0m\n'
    FAIL=$((FAIL + 1))
    EXIT_CODE=1
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
  # Extra grace period for the smoke test — health responds while migrations
  # may still be finishing on the first request. 2s eliminates the cold-start
  # race observed on first-run after bootstrap.
  sleep 2
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
