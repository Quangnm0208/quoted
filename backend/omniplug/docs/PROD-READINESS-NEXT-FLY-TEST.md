# OmniPlug v1.4.4 — Production-Readiness Checklist for Next Fly Live Test

**Use this checklist** before handing the next acceptance window to Codex.
Each item closes a gap or bug discovered in the 2026-05-20 acceptance run.

---

## §1. Code & migrations applied

These ship in the v1.4.4 update tarball produced by this session:

- [x] **Migration 021** — `idx_articles_tenant_status_published` covering
      both WHERE + ORDER BY. Eliminates `USE TEMP B-TREE FOR ORDER BY` on
      public article listing. Verified 1.63× faster at 500 articles/tenant.
- [x] **articles.repository.js** — `findMany` now uses `published_at DESC`
      (indexable) when status='published' filter is active. Falls back to
      `COALESCE` only for admin draft/mixed-status views.
- [x] **server.js** — morgan skips `/api/health` + `/health` (Fly polls
      every 30s × multiple paths × multiple machines). Healthcheck preallocates
      `SELECT 1` statement + pre-serializes response body. Saves a Statement
      object allocation + 1 JSON.stringify per probe.
- [x] **server.js** — new `/api/_perf-probe` endpoint returns server-side
      hrtime so the harness can subtract proxy overhead. NOT gated by license.
- [x] **db/connection.js** — adds `cache_size=-16384` (16 MB), `mmap_size=64MB`,
      `temp_store=MEMORY`. Tunable via `SQLITE_CACHE_KB` / `SQLITE_MMAP_BYTES`.
- [x] **scripts/load-test.mjs** — rewritten with 6 scenarios:
      health, articles, lead-capture (budget vs saturated), v1-unauth
      (rate-limited vs spread). 429-expected vs 429-error separated.
      Overhead measurement via `/api/_perf-probe`.

## §2. Documentation corrections from the first run

- [x] `CORS_ORIGIN` flagged as required production secret in `CODEX-HANDOFF`
      §1c. The first run worked because Codex set a default elsewhere; this
      is now explicit.
- [x] `CODEX-HANDOFF` §3a — proxy-vs-public-edge tradeoff documented with
      numeric example (`flyctl proxy` adds 100-200ms Wireguard RTT — that
      explains the 270ms p50 on /api/health observed in the first run).
- [x] `CODEX-HANDOFF` §3b — scenario list updated to 6 entries; status
      expectations corrected (`/api/v1/*` returns mix of 401+429 by design
      per SEC-3 — earlier doc wrongly said "all 401").
- [x] Acceptance thresholds now use `p95-ovh` (overhead-corrected) — raw
      p95 is no longer a useful SLO when running through `flyctl proxy`.

## §3. Pre-deploy verification — run BEFORE giving Codex the token

```bash
# 1. Local test battery — must be 81/81
cd /path/to/omniplug-cms-core
node tests/setup-test-db.mjs
LOAD_DB_PATH=$(pwd)/.test-data/load.db DB_PATH=$(pwd)/.test-data/load.db node tests/regression-test.mjs   # 36/36
LOAD_DB_PATH=$(pwd)/.test-data/load.db DB_PATH=$(pwd)/.test-data/load.db node tests/sec-redteam.test.mjs  # 33/33
node tests/test-fix-login-isolation.mjs                                                                  # 5/5
node tests/test-license-flow-e2e.mjs                                                                     # 7/7

# 2. Verify migration 021 is in the package
ls src/core/db/migrations/021_v144_article_list_perf.sql

# 3. Verify load-test harness has the new scenarios
grep -c 'scenarioApiV1UnauthSpread\|scenarioLeadCaptureWithinBudget\|scenarioLeadCaptureSaturated\|measureOverhead' scripts/load-test.mjs
# Expected: 6

# 4. Verify perf probe endpoint is registered
grep -c '/api/_perf-probe' src/backend/server.js
# Expected: 3 (1 declaration + 2 comment refs)

# 5. Verify SQLite pragmas are in place
grep -E 'cache_size|mmap_size|temp_store' src/core/db/connection.js
```

## §4. Token + scope rules (UNCHANGED from first run)

- [ ] Generate org-level token with 2h expiry:
  ```bash
  flyctl tokens create org --expiry 2h --name "codex-v144-test-$(date +%Y%m%d-%H%M)"
  ```
- [ ] Save token ID for revocation:
  ```bash
  flyctl tokens list | grep "codex-v144-test-"
  ```
- [ ] Pre-flight: take volume snapshot before handing over the token
  ```bash
  flyctl volumes snapshots create cms_data -a omniplug-cms-prod
  ```
- [ ] Hand Codex 3 things: token string, `omniplug-cms-core-v1.4.4.zip`
      (this update), `CODEX-HANDOFF-v1.4.4.md` (in zip at `docs/`).

## §5. Expected outcomes after the fixes

The first acceptance pass measured (running through `flyctl proxy`):

| Scenario | p50 | p95 | rps | Note |
| --- | ---: | ---: | ---: | --- |
| health | 270ms | 710ms | 63 | Most of latency is Wireguard RTT |
| articles | 351ms | 686ms | 40 | TEMP B-TREE in query plan |
| lead-capture | 286ms | 1293ms | 52 | 76% 429 from rate limit |
| v1-unauth | 346ms | 1726ms | 24 | 66% 429 from SEC-3 |

Expected with the v1.4.4 update, **same proxy path**:

| Scenario | p50-ovh | p95-ovh | rps | Note |
| --- | ---: | ---: | ---: | --- |
| health | ≤ 50ms | ≤ 150ms | ≥ 100 | morgan skip + cached probe |
| articles | ≤ 100ms | ≤ 400ms | ≥ 60 | indexed ORDER BY, no temp B-tree |
| lead-capture (budget) | ≤ 200ms | ≤ 600ms | ≥ 40 | spoofed IPs, all 201 |
| v1-unauth-spread | ≤ 100ms | ≤ 200ms | ≥ 50 | spread IPs isolates SEC-1 cost |

The `-ovh` suffix means "overhead-corrected" — subtract median proxy RTT
(~80-150ms for `flyctl proxy`, ~10-30ms for public HTTPS edge from Singapore).

If running against the **public HTTPS edge** with real tenant domains, raw
p95 should be within these targets directly without correction.

## §6. RAM/disk projections

The v1.4.4 SQLite tuning adds memory pressure that needs accounting for on
the 512 MB machine:

| Component | First run (observed) | After v1.4.4 update | Margin |
| --- | ---: | ---: | ---: |
| Node RSS | 123 MB | ~125 MB (unchanged) | |
| SQLite page cache | ~2 MB (default) | ~16 MB | +14 MB |
| SQLite mmap window | 0 | ≤64 MB | +64 MB |
| WAL file | 11 MB | ≤16 MB | +5 MB |
| OS / hallpass / tini | ~30 MB | ~30 MB | |
| **Total budget** | **~166 MB** | **~250 MB** | comfortable under 512 |

If you stay on shared-cpu-1x / 512 MB, all 6 scenarios should fit. If you
move to performance-1x / 2 GB (one customer pays for it), bump
`SQLITE_CACHE_KB=65536` (64 MB) for headroom — article queries get more
benefit at 1000+ articles per tenant.

## §7. What NOT to do this run

- [ ] Do NOT change `LICENSE_ENFORCEMENT` to `strict`. No real key, no real
      activations. Keep `warn` like first run.
- [ ] Do NOT enable telemetry. Keep `TELEMETRY_URL='disabled'`.
- [ ] Do NOT scale to performance-1x for the test alone — measure the
      shared-cpu-1x ceiling first so you know what each customer costs.
- [ ] Do NOT add a real customer's domain to test tenants. Test uses
      `.test.omniplug.local` only.

## §8. Acceptance gate for THIS run

Codex's tarball MUST contain:

- `load-test-report.txt` showing 6 scenarios with p95-ovh values
- `post-load-snapshot.txt` showing RAM ≤ 300 MB sustained
- `fly-deploy-log.txt` confirming clean boot with v1.4.4 startup messages
- `seed-output.txt` showing 90 tenants / 150K leads / ~50MB DB

If `articles p95-ovh > 400ms`, investigate index hit rate via:
```bash
flyctl ssh console -a omniplug-cms-prod -C 'cd /app && node -e "
  const db = require(\"better-sqlite3\")(\"/app/data/cms.db\");
  console.log(db.prepare(\"EXPLAIN QUERY PLAN SELECT * FROM articles WHERE tenant_id=1 AND deleted_at IS NULL AND status='\''published'\'' ORDER BY published_at DESC LIMIT 10\").all());
"'
```

Expected output: `SEARCH articles USING INDEX idx_articles_tenant_status_published`
with NO `TEMP B-TREE` entry.

## §9. Post-test cleanup

Same as first run — revoke token, optionally drop seeded data, snapshot
volume one more time as forensic evidence.

```bash
# At T+2h sharp
flyctl tokens revoke <token-id>

# Cleanup test data (optional)
flyctl ssh console -a omniplug-cms-prod -C 'sh -c "cd /app && \
  node -e \"
    const db = require('better-sqlite3')('/app/data/cms.db');
    const removed = {
      leads: db.prepare(\\\"DELETE FROM leads WHERE id IN (SELECT l.id FROM leads l JOIN tenants t ON l.tenant_id=t.id WHERE t.settings_json LIKE '%seeded_by\\\\\\\":\\\\\\\"load-seed%')\\\").run().changes,
      tenants: db.prepare(\\\"DELETE FROM tenants WHERE settings_json LIKE '%seeded_by\\\\\\\":\\\\\\\"load-seed%'\\\").run().changes,
    };
    console.log('Cleaned:', removed);
  \""'
```

---

*Last updated: 2026-05-20 (after v1.4.4 acceptance run)*
*Reference: `evidence/v1.4.4-acceptance-20260520/load-test-report.txt`*
