#!/usr/bin/env bash
# bootstrap.sh — first-time setup for a fresh checkout.
#
# Idempotent: rerun safely. Does NOT install Node — that's a pre-req
# (need Node 22 for the backend, ≥18 for the SDK + frontend tooling).
#
# What it does:
#   1. Check Node version + system packages for better-sqlite3 build
#   2. Install backend dependencies (npm ci or npm install)
#   3. Install frontend dev dependencies
#   4. Install SDK dependencies (none today, but reserved for future deps)
#   5. Generate or reuse the local .env (with LS test-mode defaults)
#   6. Run all database migrations + schema verifier
#   7. Print "next steps" with the 1-command dev runner.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }
step()   { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# ── 1. Pre-reqs ────────────────────────────────────────────────────────
step "Checking prerequisites"
node_v="$(node --version 2>/dev/null || echo 'none')"
if [[ "$node_v" == "none" ]]; then
  red "Node.js not installed. Need v22.x for the backend (https://nodejs.org)."
  exit 1
fi
node_major="${node_v#v}"
node_major="${node_major%%.*}"
if [[ "$node_major" -lt 22 || "$node_major" -ge 24 ]]; then
  red "Node $node_v detected. Backend requires >=22 <24 (per backend/omniplug/.nvmrc)."
  red "Use: nvm install 22 && nvm use 22"
  exit 1
fi
green "  ✓ Node $node_v (compatible)"

for cmd in npm python3 make g++; do
  if ! command -v "$cmd" >/dev/null; then
    red "Missing required tool: $cmd"
    [[ "$cmd" == "python3" || "$cmd" == "make" || "$cmd" == "g++" ]] && \
      red "  (needed by better-sqlite3 native build; install build-essential + python3 on Debian/Ubuntu)"
    exit 1
  fi
done
green "  ✓ npm + build tools present"

# ── 2. Backend deps ────────────────────────────────────────────────────
step "Installing backend dependencies (npm ci)"
( cd backend/omniplug && [ -f package-lock.json ] \
    && npm ci --no-audit --no-fund \
    || npm install --no-audit --no-fund ) > /tmp/quoted-bootstrap-be.log 2>&1 \
  && green "  ✓ backend/omniplug/node_modules ready" \
  || { red "  ✗ npm install failed (see /tmp/quoted-bootstrap-be.log)"; exit 1; }

# ── 3. Frontend deps ───────────────────────────────────────────────────
step "Installing frontend dev dependencies"
( cd frontend && npm install --no-audit --no-fund ) > /tmp/quoted-bootstrap-fe.log 2>&1 \
  && green "  ✓ frontend/node_modules ready" \
  || { red "  ✗ npm install failed (see /tmp/quoted-bootstrap-fe.log)"; exit 1; }

# ── 4. SDK deps ────────────────────────────────────────────────────────
step "Verifying SDK package (zero runtime deps)"
( cd sdk/js-client && node --check src/index.js ) \
  && green "  ✓ @quoted/sdk syntax clean" \
  || { red "  ✗ SDK syntax check failed"; exit 1; }

# ── 5. Local .env ──────────────────────────────────────────────────────
step "Ensuring backend/omniplug/.env exists"
if [ ! -f backend/omniplug/.env ]; then
  cp backend/omniplug/.env.example backend/omniplug/.env
  yellow "  → Copied .env.example to .env"
else
  green "  ✓ .env already present (not overwritten)"
fi

# Test-mode opt-in: passing --test-mode (or having TEST_MODE=true already
# in .env) → seed mockup defaults so the full purchase + license flow
# works locally without real Lemon Squeezy / Perplexity credentials.
# Production runs MUST NOT call bootstrap with --test-mode.
WANT_TEST_MODE="0"
for arg in "$@"; do
  [ "$arg" = "--test-mode" ] && WANT_TEST_MODE="1"
done
if grep -qE '^LEMONSQUEEZY_TEST_MODE=true$' backend/omniplug/.env; then
  WANT_TEST_MODE="1"
fi
if [ "$WANT_TEST_MODE" = "1" ]; then
  step "Seeding test-mode placeholder values"
  if grep -qE '^LEMONSQUEEZY_TEST_MODE=false$' backend/omniplug/.env; then
    sed -i 's|^LEMONSQUEEZY_TEST_MODE=false$|LEMONSQUEEZY_TEST_MODE=true|' backend/omniplug/.env
  elif ! grep -q '^LEMONSQUEEZY_TEST_MODE=' backend/omniplug/.env; then
    echo 'LEMONSQUEEZY_TEST_MODE=true' >> backend/omniplug/.env
  fi
  # seed_test_default: fill in key if absent or empty. Idempotent.
  seed_test_default() {
    local key="$1" value="$2"
    if ! grep -qE "^${key}=.+" backend/omniplug/.env; then
      if grep -qE "^${key}=$" backend/omniplug/.env; then
        sed -i "s|^${key}=$|${key}=${value}|" backend/omniplug/.env
      else
        echo "${key}=${value}" >> backend/omniplug/.env
      fi
    fi
  }
  seed_test_default LEMONSQUEEZY_API_KEY                  'test-key-fake-1234567890'
  seed_test_default LEMONSQUEEZY_STORE_ID                 '99999'
  seed_test_default LEMONSQUEEZY_WEBHOOK_SECRET           'test-webhook-secret-for-local-only'
  seed_test_default LEMONSQUEEZY_VARIANT_PRO_MONTHLY      '100001'
  seed_test_default LEMONSQUEEZY_VARIANT_PRO_YEARLY       '100002'
  seed_test_default LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY   '100003'
  seed_test_default LEMONSQUEEZY_VARIANT_AGENCY_YEARLY    '100004'
  seed_test_default LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY     'https://example.lemonsqueezy.com/checkout/buy/test-pro-monthly'
  seed_test_default LEMONSQUEEZY_CHECKOUT_PRO_YEARLY      'https://example.lemonsqueezy.com/checkout/buy/test-pro-yearly'
  seed_test_default LEMONSQUEEZY_CHECKOUT_AGENCY_MONTHLY  'https://example.lemonsqueezy.com/checkout/buy/test-agency-monthly'
  seed_test_default LEMONSQUEEZY_CHECKOUT_AGENCY_YEARLY   'https://example.lemonsqueezy.com/checkout/buy/test-agency-yearly'
  seed_test_default CITATIONS_TEST_MODE                   'true'
  seed_test_default LIVE_AI_TEST_MODE                     'true'
  seed_test_default APP_BASE_URL                          'http://127.0.0.1:5500'
  seed_test_default API_BASE_URL                          'http://127.0.0.1:4000'
  green "  ✓ test-mode .env ready (LS + Perplexity API calls return synthetic responses)"
  yellow "  ⚠ PRODUCTION: server.js refuses to boot with any *_TEST_MODE=true"
else
  yellow "  → Production-shape .env detected. /payments and /licenses will"
  yellow "    fail until you set the LEMONSQUEEZY_* values. For local demo, re-run:"
  yellow "        bash scripts/bootstrap.sh --test-mode"
fi

# ── 6. DB migrations + schema verify ───────────────────────────────────
step "Running database migrations"
( cd backend/omniplug && node --env-file=.env src/core/db/migrate.js ) \
  | grep -E '^▸|^  [✓✗]' || true
( cd backend/omniplug && node --env-file=.env scripts/verify-schema.js ) \
  | tail -1

# ── 7. Done ────────────────────────────────────────────────────────────
green ""
green "═══════════════════════════════════════════════════════════"
green "  Bootstrap complete."
green "═══════════════════════════════════════════════════════════"
cat <<EOF

Next:
  npm run dev          start backend (:4000) + frontend (:5500)
  npm test             run every test suite (BE smoke + commercial + SDK + PHP)
  npm run check        SQL lint + schema verifier + PHP syntax check

The default .env runs in LEMONSQUEEZY_TEST_MODE so checkout + activation
work end-to-end against a mock LS. Replace the LS_* values with real
credentials before deploying — see docs/DEPLOYMENT.md.

Stuck? docs/MODULE-MAP.md has the "how to trace a bug" table.

EOF
