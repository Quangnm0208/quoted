# v1.4.3 Hotfix — Test Scripts

These are the verification scripts for each fix. Use them to validate the hotfix
on YOUR test environment before rolling to production.

## Prerequisites

- Node.js 22+ (uses built-in `node:sqlite` — no native deps required)
- Your test database with realistic data, OR run `seed.mjs` to generate one

## Quick start

```bash
# 1. Generate a load-test DB (30 tenants × 1k-5k leads, ~25 MB)
mkdir -p /tmp/loadtest
node --no-warnings tests/seed.mjs
# Outputs: /tmp/loadtest/load.db, /tmp/loadtest/tenant-counts.json

# 2. Run each fix verification (each test is independent)
node --no-warnings tests/test-fix-16.mjs       # IndexNow atomic throttle
node --no-warnings tests/test-fix-17-18.mjs    # content_html size cap
node --no-warnings tests/test-fix-10.mjs       # 404 flush partial-failure
node --no-warnings tests/test-fix-4.mjs        # Cached prepared statements
node --no-warnings tests/test-fix-21b.mjs      # Tenant guards
node --no-warnings tests/test-fix-5679.mjs     # Path normalization
node --no-warnings tests/test-fix-11.mjs       # URI sanitization

# 3. Full regression test against patched codebase
# (Run from inside your patched v1.4.2 source tree)
node --no-warnings tests/regression-test.mjs
```

## Expected results

| Script | Pass criteria |
|--------|--------------|
| `test-fix-16.mjs` | 100 concurrent submits → exactly 1 INSERT, 99 throttled |
| `test-fix-17-18.mjs` | 12/12 schema cases + 4/4 service guard checks |
| `test-fix-10.mjs` | All-valid 50/50; mixed batch keeps 10 + skips 1; all-bad clean |
| `test-fix-4.mjs` | 6/6 equivalence cases; cache bounded ≤30 |
| `test-fix-21b.mjs` | 13/13 cases (undefined/null/string throw; number passes) |
| `test-fix-5679.mjs` | 16/16 normalization cases |
| `test-fix-11.mjs` | 16/16 URI sanitization cases |
| `regression-test.mjs` | 36/36 (15 imports + 12 API surface + 9 pure-function) |

## What each test verifies

### test-fix-16.mjs — BUG #16 IndexNow race
- 100 concurrent `setImmediate(tryInsert)` for same URL → exactly 1 row inserted
- Manual submission (`thresholdSec=0`) bypasses throttle
- 3 sequential auto-submits within window → 1 row (throttle works)
- Performance comparison vs old 2-step approach

### test-fix-17-18.mjs — BUG #17/#18 content_html cap
- `articleInputSchema` rejects content > 200 KB
- Schema accepts empty/normal/at-limit content
- Vietnamese UTF-8 measured correctly in bytes (not chars)
- Service-layer `guardContentSize()` is wired in `buildOpts()` before `parseDom()`
- Imports `CONTENT_HTML_MAX_BYTES` from articles.schema

### test-fix-10.mjs — BUG #10 404 flush
- All-valid batch: 50/50 committed
- Mixed batch (10 good + 1 orphan FK): old behaviour loses all 10; new keeps 10, skips 1
- All-bad batch: clean skip, no exception
- Performance comparison (SAVEPOINT overhead)

### test-fix-4.mjs — BUG #4 prepared statement cache
- 6 different filter shapes (plain, status, search, combined, deep-offset, include-deleted) return same rows + counts as uncached version
- Cache stays bounded at MAX_CACHE = 30 entries even with 100 unique shapes
- Performance comparison over 5000 mixed requests

### test-fix-21b.mjs — BUG #21 tenant guards
- 8 type checks (undefined/null/string/empty/number/float/NaN/object)
- 5 payload-variant checks (null/empty/wrong-type/undefined/valid)

### test-fix-5679.mjs — BUG #5/6/7/9 path normalization
- ASCII-only lowercase preserves Vietnamese diacritics
- Null bytes rejected → empty string return
- Multiple slashes collapsed
- Fragments stripped
- All v1.4.2 existing behaviour preserved

### test-fix-11.mjs — BUG #11 URI sanitization
- 8 rejection patterns: `..` as path segment, null bytes
- 8 acceptance patterns: dots in slugs, Vietnamese, version strings

### regression-test.mjs — Full module surface check
- All 15 patched modules import cleanly via dynamic `import()`
- All 12 expected exports still present (no removed surface)
- Pure-function smoke test on `htmlToText`, `countWords`, `parseDom`, `runRules`
- Schema cap is correctly exported
- normalizePath edge cases via `_internals` test helper

## Re-running against your DB

If you have your own production-shape test DB, edit `seed.mjs` to skip the
data generation step, or point tests at your DB path:

```javascript
// In each test-fix-*.mjs file, change:
const db = new DatabaseSync('/tmp/loadtest/load.db');
// to your DB path:
const db = new DatabaseSync('/path/to/your/test.db');
```

Tests are non-destructive on existing data — they create rows in scratch URIs
like `/test-fix10-*` then clean up at end.

## Troubleshooting

**"db.transaction is not a function"** — node:sqlite doesn't expose `.transaction()`
like better-sqlite3 does. The tests work around this with BEGIN/COMMIT.
In your production code (better-sqlite3), `.transaction()` works fine.

**"FOREIGN KEY constraint failed"** — expected in some tests. They intentionally
insert orphan tenant_ids to verify the partial-failure handling.

**"Cannot find module 'zod'"** — `test-fix-17-18.mjs` needs zod available.
Run from inside your repo where node_modules has zod:
```bash
cd /your/v143-patched-repo
node --no-warnings tests/test-fix-17-18.mjs
```

**Tests pass but production fails** — check that you actually copied the files
into the right paths. The zip mirrors `src/backend/modules/` exactly.

---

Tests bundled with omniplug-cms-core-v1.4.3-hotfix.zip · 2026-05-19

---

## loadtest-fly.mjs — Production-scale load test

Reproduces the bug-report scenario: **30 businesses × 3 users × 5,000 leads = 150,000 leads**.

### Run locally

```bash
# 1. Start the CMS server in another terminal
npm start

# 2. Run the load test
BASE_URL=http://localhost:4000 \
ADMIN_EMAIL=admin@omniplug.local \
ADMIN_PASSWORD=ChangeMe123! \
N_TENANTS=30 LEADS_PER_TENANT=5000 \
PUBLIC_RPS=30 DURATION_S=20 \
node --no-warnings tests/loadtest-fly.mjs
```

### Run against Fly.io production

```bash
# 1. Temporarily raise rate limit so the test can submit (Fly.io)
flyctl secrets set LEAD_RATE_LIMIT_PER_HOUR=10000

# 2. Run test pointing at production
BASE_URL=https://your-app.fly.dev \
ADMIN_EMAIL=your-admin@example.com \
ADMIN_PASSWORD=YourPassword \
N_TENANTS=30 LEADS_PER_TENANT=5000 \
PUBLIC_RPS=30 DURATION_S=20 \
node --no-warnings tests/loadtest-fly.mjs

# 3. RESTORE production rate limit (CRITICAL!)
flyctl secrets unset LEAD_RATE_LIMIT_PER_HOUR

# 4. Optional: clean up test data
flyctl ssh console -C "sqlite3 /app/data/cms.db \"DELETE FROM leads WHERE source='load-test'; DELETE FROM tenants WHERE slug LIKE 'biz-%';\""
```

### Expected results (v1.4.3 baseline)

| Endpoint | p50 | p95 | p99 | Errors |
|---|---|---|---|---|
| POST /api/public/leads | ~2 ms | <15 ms | <30 ms | 0% |
| GET /api/admin/leads (offset 0) | ~2 ms | <12 ms | <20 ms | 0% |
| GET /api/admin/leads (offset 4950) | ~2 ms | <5 ms | <10 ms | 0% |
| GET /api/admin/leads?status=new | ~2 ms | <6 ms | <15 ms | 0% |

For Fly.io remote tests, add ~20-50 ms p50 for network latency depending on
your distance from the deployment region.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:4103` | CMS endpoint |
| `ADMIN_EMAIL` | `admin@omniplug.local` | Admin login |
| `ADMIN_PASSWORD` | `Test1234!` | Admin password |
| `N_TENANTS` | `30` | Number of business tenants to create |
| `LEADS_PER_TENANT` | `5000` | Leads seeded per tenant |
| `PUBLIC_RPS` | `50` | Target sustained req/sec |
| `DURATION_S` | `20` | HTTP load test duration |
| `PROJECT_ROOT` | (cwd) | Path to project for DB seeding |

### Notes

- **Bulk seeding via direct DB writes** is intentional. Submitting 150,000
  leads over HTTP at 30 RPS would take 1+ hour. The bulk path tests the
  same schema and indexes that production queries use.
- **The test promotes admin to `platform_admin`** to create tenants. This is
  a one-time bootstrap; revert with the inverse script if needed.
- **Set `LEAD_RATE_LIMIT_PER_HOUR=10000`** before running, otherwise 80%+
  of public submits will return 429 (correct production behaviour, but
  defeats the load test).
