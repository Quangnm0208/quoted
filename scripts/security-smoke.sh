#!/usr/bin/env bash
# scripts/security-smoke.sh
#
# Validates the 4 P0 security guards added in v0.6.2:
#   P0.1 — /api/admin/quoted/* requires platform admin (tenant_id=1, role=admin)
#   P0.2 — activation token bound to normalized domain; replay on other domain rejected
#   P0.3 — /api/public/llm reaches its controller (not blocked by host resolver)
#   P0.4 — production refuses to boot with LEMONSQUEEZY_TEST_MODE=true
#
# Run against a live backend on $BASE (default http://127.0.0.1:4000).
# Backend MUST be in dev mode for this script — P0.4 spawns a separate
# production-env child process to test that specific guard.

set -uo pipefail
BASE="${BASE:-http://127.0.0.1:4000}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

assert_eq() {
  local got="$1" expected="$2" label="$3"
  if [ "$got" = "$expected" ]; then
    printf "  %s %-50s (got %s)\n" "$(green ✓)" "$label" "$got"
    PASS=$((PASS+1))
  else
    printf "  %s %-50s (got %s, expected %s)\n" "$(red ✗)" "$label" "$got" "$expected"
    FAIL=$((FAIL+1))
  fi
}

# ── Pre-flight ──────────────────────────────────────────────────────
if ! curl -fsS -o /dev/null "$BASE/api/health"; then
  echo "✗ Backend not reachable at $BASE — start it first with: npm run dev"
  exit 1
fi

echo
echo "═══ P0.1 — platform-admin guard on /api/admin/quoted/* ═══"

# Unit-test the middleware directly (deterministic, doesn't depend on DB state)
node --env-file=backend/omniplug/.env -e "
const { requirePlatformAdmin } = await import('./backend/omniplug/src/core/middleware/requirePlatformAdmin.js');
function call(user) {
  let nextCalled = false, status = null, body = null;
  const req = { user };
  const res = { status(s){status=s;return this;}, json(b){body=b;return this;} };
  requirePlatformAdmin(req, res, () => { nextCalled = true; });
  return { nextCalled, status, errorCode: body?.error?.code };
}
const tests = [
  { user: { tenant_id: 1, role: 'admin' }, expected: { nextCalled: true }, name: 'platform admin allowed' },
  { user: { tenant_id: 2, role: 'admin' }, expected: { status: 403, errorCode: 'PLATFORM_ADMIN_REQUIRED' }, name: 'tenant-2 admin denied' },
  { user: { tenant_id: 1, role: 'editor' }, expected: { status: 403, errorCode: 'PLATFORM_ADMIN_REQUIRED' }, name: 'tenant-1 editor denied' },
  { user: null, expected: { status: 401, errorCode: 'AUTH_REQUIRED' }, name: 'no user denied' },
];
let ok = true;
for (const t of tests) {
  const r = call(t.user);
  for (const k of Object.keys(t.expected)) {
    if (r[k] !== t.expected[k]) {
      console.log('  ✗ ' + t.name + ' (' + k + ': got ' + r[k] + ', want ' + t.expected[k] + ')');
      ok = false; break;
    }
  }
  if (ok) console.log('  ✓ ' + t.name);
}
process.exit(ok ? 0 : 1);
" && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

# Live test: admin token (tenant 1) reaches dashboard
TOKEN=$(curl -sS -X POST -H "Content-Type: application/json" -d '{"email":"admin@omniplug.local","password":"ChangeMe123!"}' "$BASE/api/auth/login" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
CODE=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/quoted/dashboard")
assert_eq "$CODE" "200" "platform admin → /quoted/dashboard"
CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/admin/quoted/dashboard")
assert_eq "$CODE" "401" "no auth → /quoted/dashboard"

echo
echo "═══ P0.2 — activation token domain binding ═══"

# Mint a token bound to example.com via the live service module
TOKEN_ACTIVATION=$(cd backend/omniplug && node --env-file=.env -e "
const { normalizeDomain } = await import('./src/backend/modules/commerce/licenses/licenses.service.js');
const jwt = (await import('jsonwebtoken')).default;
const t = jwt.sign({
  sub: 'license:99', customer_id: 1, license_id: 99, plan_id: 'pro',
  site_url: 'https://example.com',
  normalized_domain: normalizeDomain('https://example.com'),
}, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(t);
" 2>&1 | tail -1)

CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN_ACTIVATION" -H "Content-Type: application/json" -d '{"site_url":"https://attacker.com"}' "$BASE/api/v1/licenses/validate")
assert_eq "$CODE" "403" "token for example.com replayed on attacker.com"

CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN_ACTIVATION" -H "Content-Type: application/json" -d '{"site_url":"https://www.example.com"}' "$BASE/api/v1/licenses/validate")
# www-stripped match → passes domain check → fails LICENSE_NOT_FOUND (license_id=99 fake) = 404
assert_eq "$CODE" "404" "token for example.com used on www.example.com (www stripped)"

CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN_ACTIVATION" -H "Content-Type: application/json" -d '{"site_url":"https://EXAMPLE.COM"}' "$BASE/api/v1/licenses/validate")
assert_eq "$CODE" "404" "token for example.com used on uppercase EXAMPLE.COM"

echo
echo "═══ P0.3 — /api/public/llm route reaches controller ═══"

# 404 + controller-style body "# Site not registered" proves we reached the controller
BODY=$(curl -sS "$BASE/api/public/llm/sitemap.txt" -H "X-Quoted-Domain: nonexistent.test")
if echo "$BODY" | grep -q "# Site not registered with Quoted"; then
  printf "  %s LLM controller reached (unknown-domain 404 with controller body)\n" "$(green ✓)"
  PASS=$((PASS+1))
else
  printf "  %s LLM controller body: %s\n" "$(red ✗)" "$BODY"
  FAIL=$((FAIL+1))
fi

echo
echo "═══ P0.4 — production boot refuses TEST_MODE=true ═══"

cd backend/omniplug
OUT=$(NODE_ENV=production LEMONSQUEEZY_TEST_MODE=true \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ADMIN_EMAIL=admin@quoted.local ADMIN_INITIAL_PASSWORD="StrongProductionPw123!" \
  LEMONSQUEEZY_WEBHOOK_SECRET="whsec_test_xxx" \
  CORS_ORIGIN="https://quotedeasy.com" \
  TENANT_DEFAULT_DOMAIN="api.quotedeasy.com" \
  timeout 4 node src/backend/server.js 2>&1)
if echo "$OUT" | grep -q "LEMONSQUEEZY_TEST_MODE=true is forbidden"; then
  printf "  %s production refuses LEMONSQUEEZY_TEST_MODE=true\n" "$(green ✓)"
  PASS=$((PASS+1))
else
  printf "  %s did NOT refuse: %s\n" "$(red ✗)" "$(echo "$OUT" | head -2)"
  FAIL=$((FAIL+1))
fi

OUT=$(NODE_ENV=production \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ADMIN_EMAIL=admin@quoted.local ADMIN_INITIAL_PASSWORD="StrongProductionPw123!" \
  CORS_ORIGIN="https://quotedeasy.com" \
  TENANT_DEFAULT_DOMAIN="api.quotedeasy.com" \
  timeout 4 node src/backend/server.js 2>&1)
if echo "$OUT" | grep -q "LEMONSQUEEZY_WEBHOOK_SECRET is required"; then
  printf "  %s production refuses missing WEBHOOK_SECRET\n" "$(green ✓)"
  PASS=$((PASS+1))
else
  printf "  %s did NOT refuse: %s\n" "$(red ✗)" "$(echo "$OUT" | head -2)"
  FAIL=$((FAIL+1))
fi
cd ../..

echo
echo "═══════════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  printf "  %s %d/%d security checks passed\n" "$(green ✓)" "$PASS" "$((PASS+FAIL))"
  echo "═══════════════════════════════════════════════════════════"
  exit 0
else
  printf "  %s %d pass / %d fail\n" "$(red ✗)" "$PASS" "$FAIL"
  echo "═══════════════════════════════════════════════════════════"
  exit 1
fi
