# Migration Notes — v1.4.3 (Hotfix)

**Release date:** 2026-05-19
**Type:** Hotfix on top of v1.4.2 (which itself adds SEO operations on v1.4.0)
**Breaking changes:** None
**Schema changes:** One additive migration (015 — performance indexes,
idempotent). Plus migration 014 is fixed to not error on `no such table:
pages`.
**New dependencies:** `jsdom@27.4.0` declared (was previously imported but
not declared — clean install would fail)

## Upgrade path

### From v1.4.2 (with deployed DB)

1. **Back up your database first.**
   ```bash
   cp data/cms.db data/cms.db.v142.bak
   ```
2. Unzip v1.4.3 over your v1.4.2 source tree (or replace the entire source).
3. **Install jsdom** if not already present:
   ```bash
   npm install          # picks up new jsdom dependency from package.json
   ```
   Or for reproducible production install:
   ```bash
   rm -rf node_modules    # wipe stale install
   npm ci                 # uses updated package-lock.json
   ```
4. Restart your service:
   ```bash
   npm start              # runs migrate → verify → server
   ```
   The migration runner will detect 014 was previously applied (whether it
   errored or succeeded). The fixed 014 has the same article/project ALTER
   TABLE statements (idempotent — `ADD COLUMN IF NOT EXISTS` semantics on
   already-applied rows do nothing), so there's nothing new to run there.
   Migration **015** will apply fresh, adding two new indexes.

### From v1.4.0 or v1.3.0 (clean install)

The v1.4.3 zip contains the FULL codebase. Single-step upgrade:

```bash
unzip omniplug-cms-core-v1.4.3-final.zip -d /path/to/cms
cd /path/to/cms

# Verify Node version (must be 22.x)
node --version

# Install (uses lockfile for reproducibility)
npm ci

# Configure environment
cp .env.example .env
# Edit JWT_SECRET, ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD

# Boot — runs migrations, verifies schema, starts server
npm start

# Smoke test in another terminal
npm run test:smoke
```

## What's in this release

### Phase 3 fixes (2026-05-19, from QA/security + Fly.io scale test)

3 bugs from QA audit on real Fly.io deployment + clean-install verification:

| # | Severity | Fix location |
|---|---|---|
| login tenant-domain isolation | **CRITICAL** | `auth.controller.js` — reject login if `user.tenant_id !== req.tenantId` (platform_admin bypass) |
| Tini PID 1 warning | P2 | `Dockerfile` — `tini -s` for subreaper registration |
| Test harness portability | P2 | `tests/_helpers.mjs` + `setup-test-db.mjs` + rewrite all `test-fix-*.mjs` |

### Phase 2 fixes (2026-05-19, from clean-install audit)

6 bugs from the bug-report audit (clean install + smoke + load test at
150k leads):

| # | Severity | Fix location |
|---|---|---|
| jsdom | P0 | Added `"jsdom": "^27.4.0"` to dependencies |
| version drift | P1 | `smoke.js`, `verify-schema.js`, `start.sh` read from package.json |
| UUID telemetry | P1 | `telemetry.js` — UUID created regardless of TELEMETRY_ENABLED |
| rate-limit index | P2 | Migration 015 — `idx_leads_tenant_ip_created` |
| deep pagination | P2 | Migration 015 — `idx_leads_tenant_created` partial index |
| Node 22 docs | P3 | Added `.nvmrc`; README Requirements + Quick Start sections |

### Phase 1 fixes (from load test bug report)

7 bugs + 1 latent bug discovered during merge:

| # | Severity | Fix location |
|---|---|---|
| #16 | P0 | IndexNow race → atomic INSERT WHERE NOT EXISTS |
| #17 | P0 | content_html size cap 200KB in Zod schema |
| #18 | P0 | Same as #17 (defensive guard in seo-validator) |
| #10 | P0 | 404 flush uses SAVEPOINT per row |
| #4  | P1 | Cached prepared statements in 3 hot paths |
| #21 | P1 | requireTenant guard added to projects/* repos |
| #5,6,7,9 | P1 | normalizePath: null-byte, double-slash, fragment, ASCII-only lowercase |
| #11 | P1 | URI sanitization in 404 logMiddleware |
| #22 | P1 | Migration 014 — removed broken ALTER TABLE pages |

See `CHANGELOG.md` for detail on each.

### v1.4.2 features (carried forward)

- IndexNow integration (auto-submit URLs to Bing/Yandex/Naver/Seznam on publish)
- Redirections module (301/302/410/451 rules with regex + ReDoS guard)
- 404 Monitor with bot/scanner filter
- SEO Validator (11 block + 9 warn rules, blocks publish on blockers)
- Snippet preview endpoint for Google SERP / Facebook card previews
- Media SEO (alt-text suggestion + image size validation)
- New SEO content fields on articles + projects

## Verification

Before deploying, verify the upgrade went cleanly:

```bash
# 1. Clean install resolves
npm ci
# Should: "added 236 packages" (or more) with no ERR_MODULE_NOT_FOUND

# 2. All 15 migrations apply
npm run migrate
# Should: print "✓ applied: 015_v143_lead_performance_indexes.sql"

# 3. Schema verification
npm run verify:schema
# Should: "[verify-schema] product=OmniPlug CMS Core version=1.4.3 ..."

# 4. Smoke test
# (Server must be running on http://localhost:4000)
npm run test:smoke
# Should pass all steps including:
# - "GET /api/health returns 200" (version=1.4.3)
# - "instance_identity has one valid UUID row" (even with TELEMETRY_ENABLED=false)

# 5. Regression suite (Phase 1 fixes)
node --no-warnings tests/regression-test.mjs
# Should: 36/36 pass

# 6. Health endpoint reports v1.4.3
curl http://localhost:4000/api/health | jq .version
# → "1.4.3"

# 7. Confirm rate-limit query uses new index
sqlite3 data/cms.db "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM leads WHERE tenant_id=1 AND ip_address='1.2.3.4' AND created_at > datetime('now','-1 hour');"
# Should: SEARCH leads USING COVERING INDEX idx_leads_tenant_ip_created
```

## Rollback

If something breaks visibly:

1. Stop your service
2. Restore database backup: `cp data/cms.db.v142.bak data/cms.db`
3. Restore your previous source tree
4. Restart

**Migration 015 is forward-compatible** — it only adds indexes (additive),
and dropping them with `DROP INDEX IF EXISTS` is a no-op rollback if you
choose to keep v1.4.3 schema but revert source.

Fixed migration 014 is also forward-compatible — it adds the same columns
to articles/projects (which would have been added by the broken 014 if it
hadn't errored on the pages step).

## Known limitations carried from v1.4.2

- Default 256MB Fly machine memory may still OOM on extreme SEO validator
  workload (multiple admins simultaneously scoring 199KB articles). Consider
  upgrading to 512MB if you see this. The v1.4.3 content_html size cap
  prevents the catastrophic case (1MB+ articles).
- Bot filter regex catches well-known crawlers but YandexImages, GPTBot,
  ClaudeBot, etc. are caught only if they include 'bot/' in UA. New crawler
  fingerprints may need periodic updates.

## v1.4.3-specific notes

- **Node 22 required.** The project will fail `npm ci` on Node 20 due to
  `engines.node: ">=22 <24"` constraint. Use `nvm use 22` (or fnm/volta/nodenv).
- **better-sqlite3 native build.** First `npm install` compiles the native
  binding via node-gyp, which needs `python3`, `make`, `g++`. The Dockerfile
  installs these. On Ubuntu/Debian: `apt install build-essential python3`.
- **Lockfile included.** `package-lock.json` is regenerated to v1.4.3 with
  jsdom. Use `npm ci` for reproducible production installs, NOT `npm install`
  (which may update the lockfile).
- **TELEMETRY_ENABLED=false** is now safe to set in CI/dev — the UUID row
  is still created. Smoke test will pass.

---

OmniPlug CMS Core v1.4.3 · 2026-05-19

