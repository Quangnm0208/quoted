# Quoted Backend — Extensions for OmniPlug v1.4.4

This directory contains the new modules + migrations that turn OmniPlug
into the Quoted backend (v1.5.0).

## Install steps

```bash
# From your omniplug-cms-core-v1.4.4 directory:

# 1. Copy migrations
cp /path/to/quoted-mvp-v0.1.0/backend/migrations/*.sql \
   src/core/db/migrations/

# 2. Copy modules
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/* \
      src/backend/modules/

# 3. Run migrations
node src/core/db/migrate.js

# 4. Wire routes in src/backend/server.js (see below)

# 5. Boot
npm run dev
```

## Required edits to src/backend/server.js

Add these imports near the top with the other router imports:

```js
import wpSitesRouter from './modules/wp-sites/wp-sites.controller.js';
import botCrawlsRouter from './modules/bot-crawls/bot-crawls.controller.js';
import llmsContentRouter from './modules/llms-content/llms-content.controller.js';
import citationsRouter from './modules/citations/citations.controller.js';
import liveAiTestRouter from './modules/live-ai-test/live-ai-test.controller.js';
```

Mount the routers (after existing OmniPlug routes):

```js
// Quoted (Phase 0) — WP plugin endpoints
app.use('/api/v1/wp-sites', wpSitesRouter);
app.use('/api/v1/bot-crawls', botCrawlsRouter);
app.use('/api/v1/citations', citationsRouter);
app.use('/api/v1/live-test', liveAiTestRouter);
app.use('/api/public/llm', llmsContentRouter);
```

## Required env vars

Phase 0 minimum:
```
QUOTED_JWT_TTL_HOURS=24
QUOTED_FREE_POST_LIMIT=50
QUOTED_BOT_CRAWL_RETENTION_DAYS=90
```

Phase 1+ (when those modules go live, not Phase 0):
```
PERPLEXITY_API_KEY=pplx-xxx
TAVILY_API_KEY=tvly-xxx
RESEND_API_KEY=re_xxx
ONESIGNAL_APP_ID=xxx
ONESIGNAL_REST_KEY=xxx
```

## Module map

| Module | Phase | Status |
|---|---|---|
| `wp-sites/` | 0 | ✓ Full |
| `bot-crawls/` | 0 | ✓ Full |
| `llms-content/` | 0 | ✓ Full |
| `citations/` | 2 | ⚠ Stub only (returns empty) |
| `live-ai-test/` | 1 | ⚠ Stub only (returns 501) |

## Reuses from OmniPlug v1.4.4

Critical: these files must already exist in your OmniPlug:

| File | Used by Quoted for |
|---|---|
| `core/lib/licenseKey.js` | `verifyLicenseKey`, `isRevoked` |
| `core/lib/tenancy.js` | `resolveOrCreateTenant` |
| `core/lib/jwt.js` | `signJwt` |
| `core/db/connection.js` | `getDb` |
| `backend/middleware/auth.js` | `authJwt` (JWT verification middleware) |
| `backend/middleware/tenancy.js` | `tenantByHost` middleware |
| `backend/modules/articles/articles.repository.js` | `articlesRepo` for content sync |
| `backend/modules/seo-validator/seo-validator.rules.js` | (Optional) reused via markdown serializer |

If any of these are missing, Quoted modules will fail to load. Check
your OmniPlug v1.4.4 install before proceeding.

## License signing for Quoted licenses

We use OmniPlug's existing license signing infrastructure with a
namespaced prefix.

Generate a Quoted license:

```bash
node scripts/op-license-sign.js \
  --email test@example.com \
  --domain test-site.local \
  --plan free \
  --days 365 \
  --product quoted

# License will be issued with prefix qtd_live_ or qtd_test_
# depending on the LICENSE_ENV environment variable.
```

If your OmniPlug script doesn't yet support the `--product quoted` flag,
see `scripts/op-license-sign-quoted-patch.md` for the small patch needed.

## Author

Nguyễn Mạnh Quang <quangnm0208@gmail.com>
