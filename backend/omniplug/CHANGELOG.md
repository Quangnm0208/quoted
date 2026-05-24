# Changelog

## 1.4.4 — License Core + API Gating + Forced Attribution (2026-05-20)

Implements **PROMPT v1.4.4** spec: operator-signed license JWTs, API-key
gating on `/api/v1/*`, soft-lock with PII masking for Community Free plan,
forced attribution headers (L1/L2/L3 by plan), 12 SEC findings hardened.

### Post-acceptance patches (after 2026-05-20 Fly.io live test)

Following the v1.4.4 acceptance run on Fly.io, applied these targeted
fixes. No security behavior was relaxed; the changes are perf + correctness
+ observability only.

**Performance**
- `db/connection.js` — added `cache_size=-16384` (16 MB), `mmap_size=64MB`,
  `temp_store=MEMORY` pragmas. Tunable via `SQLITE_CACHE_KB` /
  `SQLITE_MMAP_BYTES` env. Adds ~80 MB worst-case mmap window; total Node
  RSS stays under 250 MB on shared-cpu-1x.
- New migration `021_v144_article_list_perf.sql` — composite index
  `idx_articles_tenant_status_published(tenant_id, status, published_at DESC)
  WHERE deleted_at IS NULL`. Eliminates `USE TEMP B-TREE FOR ORDER BY` on
  public article listing.
- `articles.repository.js` `findMany` — when `status='published'` filter is
  active, ORDER BY uses `published_at DESC` directly (index-walkable)
  instead of `COALESCE(published_at, created_at)`. Admin draft/mixed views
  fall back to COALESCE. Verified 1.63× faster at 500 articles/tenant.
- `server.js` healthcheck — pre-prepares `SELECT 1` statement at boot,
  pre-serializes the OK body. Saves Statement allocation + JSON.stringify
  per probe. Combined with morgan-skip below: ~4× allocation reduction.
- `server.js` morgan logging — skips `/api/health` + `/health` so Fly's
  30s polls don't fill stdout.

**Observability**
- New `/api/_perf-probe` endpoint — returns `server_elapsed_us` so load
  tests can measure app latency excluding proxy / network / TLS overhead.
  Mounted at `/api/_perf-probe` (underscore-prefixed; not a product
  surface). No license / API key required; read-only; reveals no data.
- `scripts/load-test.mjs` — full rewrite of summarize/scenarios:
  - `summarize(label, results, elapsed, accepted)` takes the set of expected
    statuses per scenario so 429s on rate-limited scenarios are classified
    as expected, not errors.
  - 6 scenarios instead of 4: split lead-capture into budget (spoofed IPs,
    all 201) + saturated (single IP, 201+429 mix); split v1-unauth into
    rate-limited (401+429) + spread (all 401, isolates SEC-1 timing-pad).
  - Measures proxy/network overhead via `/api/_perf-probe` at start;
    emits `p95-ovh` (overhead-corrected p95) in aggregate report.

**Documentation**
- `docs/CODEX-HANDOFF-v1.4.4.md` — updated §1c (CORS_ORIGIN as required
  prod secret), §3a (proxy-vs-edge tradeoff), §3b (6 scenarios + correct
  status expectations).
- `docs/POST-MORTEM-2026-05-20.md` — full 4-axis analysis of first
  acceptance run with before/after benchmarks.
- `docs/PROD-READINESS-NEXT-FLY-TEST.md` — checklist + expected outcomes
  for the next acceptance run.
- `MASTER-INDEX-v1.4.4.md` — top-level index of where to find anything.

**Evidence preserved**
- `evidence/codex-v144-acceptance-20260520/` — raw seed output, load-test
  report, post-load snapshot from the first run, with README explaining
  what each shows and how the post-mortem patches address findings.

**Removed (cleanup)**
- `FINAL-REPORT-v1.4.4.md` — superseded by `FINAL-REPORT-1.4.4.md`
- `.test-data/` — dev scratch, not for distribution

### Original v1.4.4 release notes follow

**Zero breaking changes** to the v1.4.3 public API surface. All existing
admin/public endpoints work unchanged. New surface area is additive:
`/api/admin/license/*` + `/api/v1/*` (gated).

### New capabilities

#### License core (RS256, RSA-4096)
- Operator signs license JWTs with an offline RSA-4096 private key.
  Customer deployments verify with the public key shipped in repo at
  `keys/op-license-pub.pem`.
- Plans: `community` (free, masked) / `lite` / `standard` / `pro` / `pro_plus`.
- JWT claims: `jti`, `plan`, `signed_for` (domain bind), `iat`, `exp`,
  `customer_name`, `customer_email`, optional `features`.
- Enforcement modes: `strict` (refuse `/api/v1/*` without valid license),
  `warn` (log every 60s but allow traffic), `off` (dev/test only).
- LRU verification cache: 1000 entries, 60s TTL (SEC-4).
- Hard refuse: RSA < 4096 bits (SEC-10), JWT > 8 KB (SEC-11),
  placeholder public key (boot-time guard).

#### API keys (bcrypt cost 10, format `op_live_<8>_<32>`)
- `/api/v1/*` requires `Authorization: Bearer op_live_...`.
- Three-layer defence: per-IP token bucket (60/min, SEC-3), bcrypt
  prefix lookup with timing pad (≥80ms on miss, SEC-1), per-key burst
  bucket (5/s sustained, LRU 10k, SEC-5).
- Mint via `scripts/op-create-api-key.js` — key shown ONCE on stdout,
  bcrypt hash persisted. Revoke via `scripts/op-revoke-api-key.js`.

#### Soft-lock + PII masking
- Community plan: every lead response is masked. Phone →
  `091•••5678`, email → `a•••@example.com`, name → first letter only.
- Banner injected on every admin page: "Bạn đang dùng Community Free…".
- Upgrade unmasks all historical data (data is never destructively
  redacted — only the response layer masks).

#### Forced attribution
- `X-Powered-By: OmniPlug CMS Core` on every response.
- `X-Attribution-Level: L1` (community/lite) / `L2` (standard/pro) /
  removed entirely for `pro_plus` (white-label tier).
- Per spec §6 — non-removable below pro_plus.

#### Certificate Revocation List (CRL)
- Operator signs CRL bundles (RS256 over canonical JSON hash).
- Customer pastes signed bundle at `/admin/license.html → Sync CRL`.
- Unsigned or tampered CRLs silently refused (SEC-2).
- Until OmniPlug Bridge (v1.5+), CRL propagation is manual (email /
  customer portal upload).

### Operator toolkit (new `scripts/`)
- `op-license-sign.js` — sign JWT, refuses RSA-2048 with exit code 2.
- `op-license-revoke.js` — mark `jti` revoked in operator DB.
- `op-crl-sign.js` — produce signed CRL envelope (`--all` or `--jti`).
- `op-create-api-key.js` — mint API key, store bcrypt hash.
- `op-revoke-api-key.js` — revoke by prefix.
- `op-license-reimport.js` — DR: bulk re-import JWTs after customer DB loss.

### Security findings hardened (SEC-1 through SEC-12)

All 12 findings from PROMPT v1.4.4 §3 are landed and verified by
`tests/sec-redteam.test.mjs` (28/28 sub-assertions pass).

| ID | Risk | Fix |
| --- | --- | --- |
| SEC-1 | API key bcrypt timing oracle | DUMMY_HASH + 80ms response pad |
| SEC-2 | CRL injection via unsigned response | RS256 signature mandatory, canonical hash |
| SEC-3 | bcrypt DoS amplifier | Per-IP token bucket 60/min before bcrypt |
| SEC-4 | License verify cache unbounded | LRU 1000 entries, 60s TTL |
| SEC-5 | Burst bucket memory exhaustion | LRU 10000 entries, oldest evicted |
| SEC-6 | Cross-domain license replay | `signed_for` vs `tenant.domain` enforced |
| SEC-7 | Activation replay across tenants | `license_activations` ledger + replay_suspected audit |
| SEC-8 | Test private keys leaking to disk | In-memory `KeyObject` only, never PEM written |
| SEC-9 | Silent enforcement misconfig | Boot-time public-key check, 60s warn-mode log |
| SEC-10 | Weak RSA keys (2048) accepted | Public + sign-script both refuse < 4096 |
| SEC-11 | JWT-bomb DoS | 8 KB cap at express.json router, Zod schema, lib |
| SEC-12 | Legacy `/api/public/*` invisible | Counter + Sunset/Deprecation headers + admin endpoint |

### New migrations (all idempotent)
- `016_licenses.sql` — `licenses` + `license_revocations` tables.
- `017_tenant_license_link.sql` — `tenants.license_id`, `plan_cached`,
  `plan_checked_at`.
- `018_api_keys.sql` — `api_keys` with bcrypt hashes, indexed `key_prefix`.
- `019_api_usage.sql` — daily counter per `(api_key_id, usage_date)`.
- `020_license_activations.sql` — SEC-7 replay-detection ledger.

### Telemetry — disabled by default
- `TELEMETRY_URL=disabled` is the v1.4.4 default in `fly.toml` and
  `.env.example`. UUIDs are still generated for audit; no network egress.
- Enabling requires operator action per deployment + written customer
  consent (see `docs/RUNBOOK.md` §5).

### Docs
- `docs/RUNBOOK.md` (356 lines) — operator playbook covering
  bootstrap, onboarding, DR scenarios, key rotation, smoke checks.
- `docs/ONBOARDING.md` — customer email template (Vietnamese).
- `docs/CUSTOMER-FAQ.md` — pre-written support replies.

### Test suite
- `tests/sec-redteam.test.mjs` — 28 SEC sub-assertions.
- `tests/test-license-flow-e2e.mjs` — 7 HTTP-layer integration tests
  (login, status, activate, mismatch, oversized, replay).
- `tests/setup-license-test-db.mjs` — in-memory RSA keypair helper
  (SEC-8 compliant).

### Test results
- SEC red-team: **28/28 pass**
- License E2E: **7/7 pass**
- v1.4.3 regression: **36/36 pass** (no regressions)
- Login isolation: **5/5 pass**
- Migrations: **20/20 apply cleanly**

### Known deviations from spec
1. **Controller uses `HttpError(status, msg, code)` instead of
   `ForbiddenError(msg, code)`.** Reason: the baseline `ForbiddenError`
   constructor signature is `(msg, details)` not `(msg, code)`. Using
   it as the spec showed would silently drop the `LICENSE_DOMAIN_MISMATCH`
   code. `HttpError` preserves the error code through the response.
2. **`/api/v1/*` reuses existing `publicRouter` exports.** Spec didn't
   require new controllers, and the existing public routes are already
   tenant-scoped. Only gating + attribution differ.
3. **OmniPlug Bridge not in v1.4.4.** Spec listed it as out-of-scope.
   CRL propagation is manual until v1.5+.

### TODO for operator (Quang) — see `docs/RUNBOOK.md`
- [ ] Generate the real RSA-4096 keypair on an offline machine.
- [ ] Replace the placeholder `keys/op-license-pub.pem` with the real one.
- [ ] Decide: 1Password (now) vs YubiHSM 2 (>50 customers). YubiKey 5
      will NOT work — see runbook §1.3.
- [ ] Set `LICENSE_ENFORCEMENT=strict` in `fly.toml` once all paying
      customers have activated licenses (start with `warn` for rollout).
- [ ] Decide whether/where to host telemetry. Default stays `disabled`
      until then.
- [ ] Build customer ledger CSV per `docs/RUNBOOK.md` §2.4.

---

## 1.4.3 — Hotfix release (2026-05-19)

Fixes **16 bugs total** found across three test phases:

- **Phase 1 — Load test (30 tenants × 1-5k leads):** 7 bugs (4 P0 + 3 P1)
- **Phase 2 — Clean-install + smoke audit (30 tenants × 150k leads):** 6 bugs
  (1 P0 + 2 P1 + 2 P2 + 1 P3)
- **Phase 3 — QA/security audit + Fly.io scale test:** 3 bugs
  (1 CRITICAL security + 1 P2 ops + 1 test infrastructure)

Zero new features. Zero API surface changes. One additive migration (015 —
performance indexes, idempotent).

### Phase 3 fixes — QA/Security audit (2026-05-19)

#### CRITICAL — Login tenant-domain isolation gap

- **File:** `src/backend/modules/auth/auth.controller.js`
- **Root cause:** `/api/auth/login` resolves tenant from `Host` header for
  audit + rate limiting, but `findByEmail()` was global and did NOT check
  `user.tenant_id === req.tenantId`. So a user from tenant A could
  authenticate via tenant B's domain if they knew the credentials. The token
  was scoped correctly (no cross-tenant data leak), BUT this still violated
  the principle that tenant B's login portal should not accept tenant A's
  users at all — it leaks "this email exists" via 200-vs-401 response timing.
- **Fix:** After `findByEmail()` and password verification, check
  `req.tenantId !== user.tenant_id` → reject with the **same 401 message** as
  bad credentials (no info leak about which email belongs to which tenant).
  Platform admins (`role === 'platform_admin'`) bypass this check — they need
  to log in from any host to manage all tenants. New audit event
  `auth.login.wrong_tenant_domain` records every cross-tenant attempt.
- **Verification:** 5/5 cases pass in `tests/test-fix-login-isolation.mjs`:
  Alice via her own tenant ✓, Alice via wrong tenant ✓ (rejected), Bob
  symmetric ✓, platform admin bypass ✓, wrong password gives consistent 401
  ✓. Audit log entries verified for both `wrong_tenant_domain` and `success`
  events.

#### P2 — Tini not running as PID 1 (container init warning)

- **File:** `Dockerfile`
- **Root cause:** Fly.io machine init owns PID 1 inside the container. Without
  `tini -s`, tini doesn't register as a subreaper, so orphaned child processes
  (e.g. crashed migration scripts) wouldn't be reaped. Boot log shows warning
  `Tini is not running as PID 1 and isn't registered as a child subreaper`.
- **Fix:** Changed `ENTRYPOINT ["/usr/bin/tini", "--"]` to
  `ENTRYPOINT ["/usr/bin/tini", "-s", "--"]`. The `-s` flag (subreaper)
  explicitly tells tini to register itself even when not PID 1.

#### P2 — Test harness hardcoded paths and tenant IDs

- **Files:** `tests/test-fix-*.mjs`, `tests/regression-test.mjs`,
  `tests/_helpers.mjs` (new), `tests/setup-test-db.mjs` (new)
- **Root cause:** Test scripts hardcoded `/home/claude/omniplug-v143-hotfix`,
  `/tmp/integration`, `/tmp/v143-test`, and tenant ID `62`. Tests crashed on
  any other machine.
- **Fix:**
  - New `tests/_helpers.mjs` exports `openTestDb()` and `pickTenant(db)` for
    portable DB + tenant resolution. `LOAD_DB_PATH` env var override, default
    `.test-data/load.db`. `QA_TENANT_ID` env var override, default = first
    `biz-*` tenant or first non-default tenant.
  - New `tests/setup-test-db.mjs` bootstraps `.test-data/load.db` with all
    migrations applied + one test tenant. Idempotent.
  - All 7 `test-fix-*.mjs` rewritten to use helpers + relative paths via
    `path.resolve(__dirname, '..', 'src')`.
  - `regression-test.mjs` rewritten with relative paths.
  - New `tests/test-fix-login-isolation.mjs` verifies the CRITICAL security
    fix above.

### Phase 2 fixes — Clean-install audit (2026-05-19)

#### P0 — Missing `jsdom` dependency (blocker for `npm ci`)

- **File:** `package.json`, `package-lock.json`
- **Root cause:** `src/backend/modules/seo-validator/seo-validator.rules.js`
  imports `jsdom` (added in v1.4.2 for SEO content scoring) but the package
  was never declared in `dependencies`. Worked in dev because `jsdom` happened
  to be installed transitively or manually; failed on clean `npm ci` in
  Docker/CI with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Added `"jsdom": "^27.4.0"` to `dependencies`. Pinned 27.4 because
  jsdom 29 requires Node 24+ but our `engines.node` is `>=22 <24`. jsdom 27.4
  supports Node 22.12+ and is the latest stable for our range.
  `package-lock.json` regenerated to include all 236 packages with correct
  jsdom hash. Verified `npm ci` resolves cleanly and `seo-validator.rules.js`
  imports + `parseDom()` works.

#### P1 — Version drift in release metadata

- **Files:** `package-lock.json`, `scripts/smoke.js`, `scripts/verify-schema.js`,
  `scripts/start.sh`
- **Root cause:** Multiple files had `1.4.0` hardcoded; only `package.json`
  was bumped to `1.4.3`. Smoke test refused to pass because health endpoint
  returned `1.4.3` but smoke expected `1.4.0`.
- **Fix:** All version references now read from `package.json` at runtime
  via `JSON.parse(fs.readFileSync('package.json'))` pattern. Pattern applies
  to `smoke.js`, `verify-schema.js`, `start.sh`. Lockfile regenerated to 1.4.3.

#### P1 — `instance_identity` UUID not created when telemetry disabled

- **File:** `src/core/lib/telemetry.js`
- **Root cause:** `ensureInstanceIdentity()` was called inside `startTelemetry()`,
  AFTER the `TELEMETRY_ENABLED=false` early return. So installations with
  telemetry disabled never created the UUID row. Smoke test step
  "instance_identity has one valid UUID row" failed with `got 0`.
- **Fix:** Moved `ensureInstanceIdentity()` call BEFORE the telemetry-disabled
  check. UUID is for licensing/audit/operational identity — it must exist
  regardless of whether we phone home. Boot log now shows
  `[telemetry] disabled via TELEMETRY_ENABLED=false (UUID still created)`
  when applicable. Function also exported so external callers can ensure
  it independently.
- **Verification:** 3/3 scenarios pass (telemetry off creates UUID,
  idempotent re-boot, telemetry on works).

#### P2 — Missing index for lead rate-limit query + deep pagination

- **File:** `src/core/db/migrations/015_v143_lead_performance_indexes.sql`
  (new)
- **Root cause:** `countByIPLastHour` query in `leads.repository.js` filters
  by `(tenant_id, ip_address, created_at)` but had no covering index. SQLite
  fell back to `idx_leads_tenant_status` which doesn't include `ip_address`.
  At 5k leads/tenant this was ~10ms; at 50k leads/tenant the bug report
  measured 303ms p95. Deep pagination (admin lead inbox at offset 4950)
  measured 697ms p95.
- **Fix:** New migration 015 adds two indexes:
  - `idx_leads_tenant_ip_created` on `(tenant_id, ip_address, created_at DESC)`
    (NOT partial — rate-limit query intentionally counts deleted rows too,
    so a `WHERE deleted_at IS NULL` predicate would exclude the planner
    from picking it).
  - `idx_leads_tenant_created` on `(tenant_id, created_at DESC) WHERE deleted_at IS NULL`
    (partial — admin list always filters out deleted). Speeds up deep
    pagination.
  - `ANALYZE leads` so planner picks up new indexes immediately.
- **Verification (benchmark on 50k seeded leads):**
  - Rate-limit query: **0.155ms → 0.002ms (78× speedup, 459k req/sec)**
  - Deep pagination offset 4950: **697ms → 0.1ms (6970× speedup)**
  - EXPLAIN QUERY PLAN confirms `SEARCH leads USING COVERING INDEX
    idx_leads_tenant_ip_created`.

#### P3 — Node 22 documentation

- **Files:** `README.md`, `.nvmrc` (new)
- **Fix:** Added `.nvmrc` (`22`) alongside existing `.node-version` (covers
  both nvm and fnm/volta/nodenv ecosystems). README now has a prominent
  **Requirements** + **Quick Start** section near the top with Node 22 callout,
  build-tools dependency note, and 5-step deploy instructions.

### Phase 1 fixes — Load test bugs

#### Critical fixes (P0)

- **BUG #16 — IndexNow throttle TOCTOU race.** Two-step check-then-insert
  allowed 100 concurrent submits of same URL through throttle. Replaced with
  atomic `INSERT...WHERE NOT EXISTS` in single SQL statement
  (`indexing.repository.js:tryInsertLog`). Manual submissions bypass via
  `thresholdSec=0`. Prevents Bing IndexNow API ban under bulk-publish events.
- **BUG #17/#18 — jsdom OOM + publish DoS via large content_html.** Added
  `CONTENT_HTML_MAX_BYTES = 200_000` cap in `articleInputSchema` via Zod
  refinement. Service-layer `guardContentSize()` defends pre-existing rows
  before `parseDom()`. 1MB HTML previously caused 1GB RAM / 3-second freeze.
- **BUG #10 — 404 flush rollback lost entire batch on FK fail.**
  `batchUpsert` now uses per-row `SAVEPOINT/RELEASE/ROLLBACK TO` instead of
  one transaction. Returns `{upserted, skipped, errors}` for observability.
  Controller logs partial-flush warnings.

#### High-priority fixes (P1)

- **BUG #4 — Per-request `db.prepare()` in 3 hot paths.** Added bounded
  LRU-style cache (`_preparedCache`, max 30-50 entries) in
  `leads.repository.js`, `articles.repository.js`,
  `seo-validator.service.js`. Eliminates 2.5x re-parse overhead.
- **BUG #21 — Inconsistent tenant guards.** Added `requireTenant()` to
  `projects.repository.js`, `gallery.repository.js`,
  `milestones.repository.js`. Matches existing pattern in leads/articles/etc.
  Throws clear error on `undefined`/`null`/`string` `tenantId` instead of
  silently returning empty result.
- **BUG #5/6/7/9 — `normalizePath()` edge cases.** Reject null bytes
  (return empty), ASCII-only lowercase (avoid Turkish İ combining-dot pitfall),
  collapse multiple slashes, strip URL fragments. Vietnamese diacritics
  preserved as-is (URL slugs are ASCII-lowercase by convention).
- **BUG #11 — Path traversal stored in 404 log.** `logMiddleware` rejects
  `..` path segments and null bytes before buffer. Latent risk eliminated
  before "create-redirect-from-404" UX ships in future.
- **BUG #22 — Migration 014 `no such table: pages`** (discovered during
  merge build, fixed in this release). v1.4.2-FINAL migration 014 had six
  `ALTER TABLE pages` statements but `pages` table doesn't exist in this
  schema (landing pages are `page_sections` rows). Migration would error
  on every fresh install. Fix: replaced pages ALTER block with comment;
  articles + projects ALTER statements preserved.

### Internal

- 12 source files modified + 1 new migration. Zero new modules. Zero
  removed exports. One additive new dependency (`jsdom` — was already used,
  just declared properly now).
- New tests: `tests/test-fix-*.mjs` (one per Phase-1 fix) +
  `tests/regression-test.mjs`. Plus `tests/seed.mjs` to reproduce the
  30-tenant × 1-5k-leads load DB.
- Boot banner reads from `package.json` (was already correct since v1.3.0).
- All hardcoded version strings eliminated from scripts.

### Verification

**Phase 1 fixes:**
- 7/7 fix verification tests pass independently
- 36/36 regression tests pass (15 imports + 12 API surface + 9 pure-function)
- All 15 migrations apply cleanly (was 13/14 before BUG #22 fix)

**Phase 2 fixes:**
- `npm ci` resolves all 236 packages including jsdom
- jsdom 27.4.0 imports + parseDom returns valid DOM
- Boot log shows correct UUID-still-created message when telemetry disabled
- `/api/health` returns `"version":"1.4.3"`
- Rate-limit query uses `idx_leads_tenant_ip_created` covering index
- Deep pagination uses `idx_leads_tenant_created` partial index
- Smoke test passes (version match dynamic + UUID row exists)

**Phase 3 fixes:**
- Login tenant-domain isolation: 5/5 cases pass (incl. platform_admin bypass)
- Audit event `auth.login.wrong_tenant_domain` recorded on cross-tenant attempts
- Container init: Dockerfile now uses `tini -s` for subreaper registration
- All `tests/test-fix-*.mjs` are now portable (no hardcoded paths or IDs)

**API compatibility:** every method signature preserved; only `tryInsertLog()`
(Phase 1), `ensureInstanceIdentity()` export (Phase 2), and new audit event
`auth.login.wrong_tenant_domain` (Phase 3) are additive.

## 1.4.2 — Search visibility release (2026-05-19)

Adds advanced SEO operations on top of v1.4.0 base.

### Added

- **IndexNow integration** — auto-submit URLs to Bing/Yandex/Naver/Seznam on
  publish (Google uses sitemap, not IndexNow). Per-tenant key auto-generated.
  Admin endpoints: `GET/POST /api/admin/indexing/{log,submit,key}`.
- **Redirections module** — 301/302/307/308/410/451 rule engine with
  exact/prefix/regex matching, ReDoS-safe regex validator, auto-create from
  article/project slug changes. Hot-path in-memory cache with 5-minute SOFT TTL.
  Admin endpoints: `GET/POST/PUT/DELETE /api/admin/redirections`.
- **404 Monitor** — aggregated 404 log per tenant with bot/scanner filter.
  Buffered writes (60s flush) to avoid lock contention. Admin endpoints:
  `GET /api/admin/error-404`, `PATCH /api/admin/error-404/:id/ignore`.
- **SEO Validator** — 11 block + 9 warn rules computing 0-100 score. Blocks
  publish if any block-rule fails. Backed by `seoValidatorService.enforcePublish`.
  Admin endpoint: `GET /api/admin/seo/article/:id/score`,
  `GET /api/admin/seo/project/:id/score`.
- **Snippet preview endpoint** — read-only public API returning Google SERP
  preview shape with Edge cache `s-maxage=300`. Public endpoint:
  `GET /api/public/snippet/article/:slug`, `.../project/:slug`.
- **Media SEO** — alt-text suggestion service (`suggestAlt()` from filename).
  Image size validation in SEO validator (warns if any image > 500KB).
- 7 new SEO-related columns on `articles` + `projects`: `seo_title`,
  `seo_description`, `focus_keyword`, `secondary_keywords`, `canonical_url`,
  `robots_directive`, `og_image_id`, `seo_score`, `seo_score_at`,
  `seo_score_breakdown`.

### Migrations

- **013** — `indexing_log`, `redirections`, `error_404_log` tables. All
  tenant-scoped with `ON DELETE CASCADE`. Tight indexes on hot-read paths.
- **014** — Add SEO content fields to `articles` + `projects`.

### Subscribers

- `registerSeoSubscriber` — listens to article.published, projects.changed
- `registerIndexingSubscriber` — auto-IndexNow on publish
- `subscribeRedirectionsAutoCreate` — auto-301 on slug change

## 1.4.0

### Security

- CORS_ORIGIN required in production
- npm audit gate raised to --audit-level=high
- Fly VM memory 256MB → 512MB (prevent Sharp OOM)
- Upload pixel limit 50MP → 25MP
- bcrypt rounds default 12 → 10 (backward-compat, 4x faster on shared-cpu)
- audit_log startup pruning (AUDIT_LOG_RETENTION_DAYS, default 180d)
- SDK data-cms-html: DOMParser strip before innerHTML

### Added

- src/core/lib/roles.js — RBAC role registry (ALL_ROLES + LOGIN_ENABLED_ROLES)
- Migration 011: users.role CHECK constraint removed, enforced at app-level
- Role platform_admin: first-class tenant management (backward-compat with admin@tenant-1)
- Reserved roles: customer, vendor, b2b_partner (schema-ready, login blocked until v1.5)
- scripts/set-platform-admin.js

### Removed

- src/core/db/dialect.js (dead code, 0 imports confirmed)

## 1.3.0

### Security

- Fly min_machines_running = 1 (eliminate cold-start)
- Required ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD in production with placeholder/length guards
- Honeypot anti-spam for /api/public/leads

### Legal

- Added LICENSE.txt (PolyForm Noncommercial 1.0.0)
- Added NOTICE.txt
- license + author fields in package.json

### Attribution

- "Powered by OmniPlug" footer on admin UI (login + post-auth)
- vendor/license/homepage fields in /api/health

### Added

- Telemetry heartbeat — opt-out via TELEMETRY_ENABLED=false
- Migration 010_instance_identity

## 1.2.0

Final hardening release for OmniPlug CMS Core.

- Cleaned product identity to OmniPlug CMS Core.
- Aligned package, runtime, admin UI and health version to 1.2.0.
- Enforced production startup order: migrate, verify schema, then start server.
- Added schema verification for required tables, columns, foreign keys, tenant bootstrap and initial admin presence.
- Removed legacy customer-specific sample content from migrations and docs.
- Moved SQL access out of the remaining high-traffic controllers into repository modules.
- Documented business module packaging and frontend-agnostic API integration.
- Added Fly.io deployment, backup/restore and runbook documentation.
