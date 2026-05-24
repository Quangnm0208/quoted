# Fly.io Deployment Checklist — OmniPlug CMS Core v1.4.3

## Pre-deploy verification (do once on local machine)

```bash
# 1. Verify Node version
node --version          # MUST be v22.x

# 2. Clean install resolves
npm ci                  # MUST succeed with "added 236 packages" or similar

# 3. Run regression suite locally
npm start &             # boot server
sleep 5
node --no-warnings tests/regression-test.mjs  # 36/36 should pass
kill %1
```

## Deploy steps

```bash
# 1. Verify fly.toml app name matches your Fly.io app
grep "^app = " fly.toml
# Edit if needed: replace "omniplug-cms-prod" with your app name

# 2. Create Fly volume if not yet (one-time)
flyctl volumes create cms_data --region sin --size 1

# 3. Set production secrets (one-time)
flyctl secrets set \
  JWT_SECRET="$(openssl rand -base64 48)" \
  ADMIN_EMAIL="your-admin@yourcompany.com" \
  ADMIN_INITIAL_PASSWORD="$(openssl rand -base64 24)"

# 4. Deploy
flyctl deploy

# 5. Watch boot log
flyctl logs --tail
# Look for:
#   ✓ "OmniPlug CMS Core v1.4.3"
#   ✓ "[verify-schema] product=OmniPlug CMS Core version=1.4.3 ..."
#   ✓ "[telemetry] disabled (UUID still created)" — if TELEMETRY_ENABLED=false
#   ✗ NO "ERR_MODULE_NOT_FOUND" (jsdom fix)
#   ✗ NO migration errors

# 6. Verify health from outside
curl https://your-app.fly.dev/api/health
# Should return: {"status":"ok","version":"1.4.3", ...}
```

## Post-deploy smoke test (5 minutes)

```bash
# Run smoke test against production endpoint
BASE_URL=https://your-app.fly.dev \
ADMIN_EMAIL=your-admin@yourcompany.com \
ADMIN_INITIAL_PASSWORD=<the password you set> \
npm run test:smoke

# All 16+ steps should pass, including:
#   - "GET /api/health returns 200" with version=1.4.3
#   - "instance_identity has one valid UUID row"
```

## Load test (optional, but recommended before traffic)

The bundled `tests/loadtest-fly.mjs` simulates the production scenario:
30 businesses × 3 users × 5,000 leads = 150,000 leads.

```bash
# CRITICAL: temporarily raise rate limit (or test will hit 429 walls)
flyctl secrets set LEAD_RATE_LIMIT_PER_HOUR=10000

# Run from your laptop (the script runs HTTP requests + bulk DB seed)
BASE_URL=https://your-app.fly.dev \
ADMIN_EMAIL=your-admin@yourcompany.com \
ADMIN_PASSWORD=<your password> \
N_TENANTS=30 LEADS_PER_TENANT=5000 \
PUBLIC_RPS=30 DURATION_S=20 \
node --no-warnings tests/loadtest-fly.mjs

# Expected: p95 < 50 ms across all endpoints, 0% errors
# (Network latency adds ~20-50 ms p50 depending on distance from region)

# RESTORE production rate limit (CRITICAL)
flyctl secrets unset LEAD_RATE_LIMIT_PER_HOUR

# Clean up load-test data
flyctl ssh console -C "sqlite3 /app/data/cms.db \"
DELETE FROM leads WHERE source='load-test';
DELETE FROM tenants WHERE slug LIKE 'biz-%';
VACUUM;
\""
```

## Production health monitoring

After deploy, watch for these **4 health signals** in `flyctl logs`:

| Signal | What it means |
|---|---|
| `[error_log] flush: N upserted, M skipped (likely stale tenant_id)` | BUG #10 protection caught an orphan tenant. Was silent data loss in v1.4.2. |
| `ValidationError: Nội dung quá lớn để chấm điểm SEO` | An admin tried to publish an article >200KB. Was OOM/freeze in v1.4.2. |
| `[indexing] tryInsertLog failed: <msg>` | Rare DB error in IndexNow atomic insert. Skip URL, continue. |
| `auth.login.wrong_tenant_domain` in audit_log | **Security signal**: someone tried to log in via a tenant's domain with credentials from a different tenant. Investigate if these spike — could be credential stuffing, misconfigured DNS, or a malicious actor mapping which tenants own which emails. |

**These are EXPECTED occasional log lines, not errors.** They mean the
v1.4.3 fixes are working.

## Cross-tenant security verification (one-time post-deploy)

After v1.4.3 deploy, run a quick verification that the new login isolation
is active:

```bash
# Replace TENANT_A_DOMAIN with an actual tenant domain you own
# Replace USER_OF_OTHER_TENANT with an email that exists on a DIFFERENT tenant
# This should fail with HTTP 401 ("Invalid email or password")
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "https://your-app.fly.dev/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Host: TENANT_A_DOMAIN" \
  -d '{"email":"USER_OF_OTHER_TENANT","password":"anything"}'
# Expected: HTTP 401 (even if the password were correct, the wrong tenant
# domain triggers the new isolation check)
```

If this returns 200 with a token, the fix isn't active and you should
re-deploy from v1.4.3 source.

## Rollback plan

If anything breaks after deploy:

```bash
# 1. Revert to previous deploy
flyctl releases list
flyctl deploy --image registry.fly.io/<your-app>:deployment-<previous-id>

# 2. (Optional) Restore DB from backup
flyctl ssh console -C "cp /app/data/cms.db.backup /app/data/cms.db"
flyctl machine restart <machine-id>
```

Migration 015 is **forward-compatible** — it only adds indexes, which can
be dropped without data loss. Migration 014 fix is also forward-compatible.
No rollback DB scripts needed.

## Resource sizing

Based on v1.4.3 load testing:
- **1 GB volume holds ~3 million leads** (1 lead ≈ 350 bytes including indexes)
- **256 MB machine memory** is enough for ~10 concurrent admin sessions
- **512 MB recommended** if running SEO validator heavily or multiple workers
- **`min_machines_running = 1`** in fly.toml avoids cold-start latency (~3-4s)

## Operational notes

- `TRUST_PROXY=true` in fly.toml is **required** so the rate-limit query sees
  real client IPs via `X-Forwarded-For`. Without this, every request looks
  like it's from `127.0.0.1` and rate limit blocks everyone.
- `NODE_ENV=production` in fly.toml is **required** for proper error handling
  (stack traces hidden, etc.)
- `TELEMETRY_ENABLED` defaults to enabled. Set to `false` only if you don't
  want heartbeats to omniplug.com — the v1.4.3 fix means UUID is still
  generated either way.
- SQLite WAL mode is enabled by default. The `.wal` and `.shm` files alongside
  `cms.db` are normal and required.

## Known limitations

- **Single-region only.** This deploy is `primary_region = 'sin'` (Singapore).
  Multi-region requires read replicas; not supported in v1.4.x.
- **Single machine writes.** SQLite is single-writer. The architecture handles
  bursts via WAL, but sustained > 1000 writes/sec needs PostgreSQL (v2.0
  roadmap).
- **Default machine size:** 256 MB RAM, 1 shared CPU. Upgrade if you serve
  multiple high-traffic tenants.

---

OmniPlug CMS Core v1.4.3 · Fly.io deployment guide · 2026-05-19
