#!/usr/bin/env bash
# scripts/verify-release.sh
#
# Pre-release gate. Runs the full verification chain:
#   1. npm test         (19+ test suites)
#   2. SQL lint + schema verify (npm run check)
#   3. PHP lint
#   4. security smoke (/scripts/security-smoke.sh)
#   5. secret scan (scripts/check-no-secrets.sh)
#   6. cold-start: extract ZIP → bootstrap → test
#
# Exits non-zero if any step fails.
# Use as the FINAL gate before tagging + uploading a release.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

PASS=0
FAIL=0
SKIP=0

step() {
  local name="$1"; shift
  printf "\n══════ %s ══════\n" "$name"
  if "$@"; then
    printf "  %s %s passed\n" "$(green ✓)" "$name"
    PASS=$((PASS+1))
  else
    printf "  %s %s FAILED\n" "$(red ✗)" "$name"
    FAIL=$((FAIL+1))
  fi
}

# ── 1. SQL lint + schema verify ──
step "SQL lint + schema verify" bash -c 'npm run check'

# ── 2. Full test suite ──
step "Full test suite (npm test)" bash -c 'npm test'

# ── 3. Security smoke ──
# Need BE running. test-all.sh already starts BE, so spin up fresh.
kill $(lsof -ti:4000) 2>/dev/null || true
sleep 1
(cd backend/omniplug && nohup node --env-file=.env src/backend/server.js > /tmp/verify-be.log 2>&1) &
BE_PID=$!
for i in $(seq 1 30); do sleep 1; curl -fsS -o /dev/null http://127.0.0.1:4000/api/health && break; done
sleep 2
step "Security smoke (9 checks)" bash scripts/security-smoke.sh
kill "$BE_PID" 2>/dev/null || true
sleep 1

# ── 4. Secret scan ──
step "Secret scan (working tree)" bash scripts/check-no-secrets.sh

# ── 5. npm audit ──
printf "\n══════ npm audit (production deps) ══════\n"
npm audit --production --omit=dev > /tmp/audit.log 2>&1 || true
if grep -qE 'found 0 vulnerabilities' /tmp/audit.log; then
  printf "  %s no production vulnerabilities\n" "$(green ✓)"
  PASS=$((PASS+1))
else
  HIGH=$(grep -cE "(high|critical) severity" /tmp/audit.log 2>/dev/null | head -1)
  HIGH="${HIGH:-0}"
  if [ "$HIGH" -gt 0 ] 2>/dev/null; then
    printf "  %s %d high/critical vulnerabilities found\n" "$(red ✗)" "$HIGH"
    FAIL=$((FAIL+1))
  else
    printf "  %s only low/moderate; review manually\n" "$(green ✓)"
    PASS=$((PASS+1))
  fi
fi

# ── 6. PHP lint ──
printf "\n══════ PHP lint (wp-plugin/) ══════\n"
if command -v php >/dev/null 2>&1; then
  LINT_OK=true
  while IFS= read -r f; do
    if ! php -l "$f" >/dev/null 2>&1; then
      printf "  %s %s\n" "$(red ✗)" "$f"
      LINT_OK=false
    fi
  done < <(find wp-plugin -name '*.php' 2>/dev/null)
  if $LINT_OK; then
    printf "  %s all PHP files pass\n" "$(green ✓)"
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
else
  printf "  (php not installed — skipping)\n"
  SKIP=$((SKIP+1))
fi

# ── 7. Cold-start ZIP test (build temp ZIP, extract, bootstrap, test) ──
printf "\n══════ Cold-start ZIP test (extract → bootstrap → test) ══════\n"
TMP_ZIP=$(mktemp -u --suffix=.zip)
TMP_DIR=$(mktemp -d)
zip -rq "$TMP_ZIP" . \
  -x '*/node_modules/*' '*/node_modules' \
  -x '*/.git/*' '.git/*' '.git' \
  -x 'backend/omniplug/data/*' 'backend/omniplug/data' \
  -x 'backend/omniplug/uploads/*' 'backend/omniplug/uploads' \
  -x 'backend/omniplug/.env' \
  -x 'backend/omniplug/keys/op-license-rsa.priv.pem' \
  -x 'data/*' 'data' \
  -x '*/.DS_Store' '*/*.log' '*.log' '*.zip' 2>&1 | tail -2
unzip -q "$TMP_ZIP" -d "$TMP_DIR"
(cd "$TMP_DIR" && timeout 240 bash scripts/bootstrap.sh > /tmp/verify-bs.log 2>&1) && \
  (cd "$TMP_DIR" && timeout 240 npm test > /tmp/verify-test.log 2>&1; tail -5 /tmp/verify-test.log | sed 's/\x1b\[[0-9;]*m//g' | grep -qE "[0-9]+ pass, 0 fail")
COLD_STATUS=$?
if [ "$COLD_STATUS" -eq 0 ]; then
  PASS_COUNT=$(tail -5 /tmp/verify-test.log | sed 's/\x1b\[[0-9;]*m//g' | grep -oE "[0-9]+ pass" | head -1)
  printf "  %s extract → bootstrap → %s\n" "$(green ✓)" "$PASS_COUNT"
  PASS=$((PASS+1))
else
  printf "  %s cold-start failed; see /tmp/verify-bs.log + /tmp/verify-test.log\n" "$(red ✗)"
  FAIL=$((FAIL+1))
fi
rm -rf "$TMP_DIR" "$TMP_ZIP"

# ── Summary ──
echo
echo "═══════════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  printf "  %s release ready: %d steps passed, %d skipped\n" "$(green ✓)" "$PASS" "$SKIP"
  echo "═══════════════════════════════════════════════════════════"
  exit 0
else
  printf "  %s release blocked: %d failed, %d passed, %d skipped\n" "$(red ✗)" "$FAIL" "$PASS" "$SKIP"
  echo "═══════════════════════════════════════════════════════════"
  exit 1
fi
