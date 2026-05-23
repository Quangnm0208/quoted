# Deployment Guide

This package extends an existing OmniPlug v1.4.4 install. It does not run
standalone. Follow these steps in order.

---

## Prerequisites

- OmniPlug CMS Core v1.4.4 cloned and tested (see its README)
- Fly.io account with `omniplug-cms-prod` app already deployed
- YubiKey with operator EC P-384 key (per OmniPlug RUNBOOK-LICENSING.md)
- A WordPress site for testing (local Lando / Local by Flywheel / DigitalOcean droplet)

---

## Step 1 — Apply backend changes to OmniPlug

```bash
cd /path/to/omniplug-cms-core-v1.4.4

# Copy SQL migrations
cp /path/to/quoted-mvp-v0.1.0/backend/migrations/*.sql src/core/db/migrations/

# Copy new modules
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/wp-sites src/backend/modules/
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/bot-crawls src/backend/modules/
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/llms-content src/backend/modules/
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/citations src/backend/modules/
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/live-ai-test src/backend/modules/

# Copy operator scripts
cp /path/to/quoted-mvp-v0.1.0/backend/scripts/*.js scripts/
```

## Step 2 — Wire routes

Edit `src/backend/server.js`. Find the section where existing routes are
mounted (search for `app.use('/api/`) and add:

```js
// Quoted (Phase 0) — WP plugin endpoints
import wpSitesRouter from './modules/wp-sites/wp-sites.controller.js';
import botCrawlsRouter from './modules/bot-crawls/bot-crawls.controller.js';
import llmsContentRouter from './modules/llms-content/llms-content.controller.js';
import citationsRouter from './modules/citations/citations.controller.js';
import liveAiTestRouter from './modules/live-ai-test/live-ai-test.controller.js';

app.use('/api/v1/wp-sites', wpSitesRouter);
app.use('/api/v1/bot-crawls', botCrawlsRouter);
app.use('/api/v1/citations', citationsRouter);
app.use('/api/v1/live-test', liveAiTestRouter);
app.use('/api/public/llm', llmsContentRouter);
```

## Step 3 — Environment variables

Add to your Fly.io secrets:

```bash
# Required for Phase 0:
fly secrets set -a omniplug-cms-prod \
  QUOTED_JWT_TTL_HOURS=24 \
  QUOTED_FREE_POST_LIMIT=50 \
  QUOTED_BOT_CRAWL_RETENTION_DAYS=90

# Required for Phase 1+ (set when ready):
fly secrets set -a omniplug-cms-prod \
  PERPLEXITY_API_KEY=pplx-xxx \
  TAVILY_API_KEY=tvly-xxx \
  RESEND_API_KEY=re_xxx \
  ONESIGNAL_APP_ID=xxx \
  ONESIGNAL_REST_KEY=xxx \
  PADDLE_VENDOR_ID=xxx \
  PADDLE_API_KEY=xxx
```

## Step 4 — Run migrations on staging first

```bash
fly deploy -a omniplug-cms-staging

# Verify migrations applied
fly ssh console -a omniplug-cms-staging
$ node scripts/verify-schema.js
# Expect: wp_sites, bot_crawls, citations, notif_prefs tables present
```

## Step 5 — Smoke test backend

```bash
# Generate a test license
fly ssh console -a omniplug-cms-staging
$ node scripts/op-license-sign.js \
    --email test@example.com \
    --domain test-site.local \
    --plan free \
    --days 30

# Note the output license key.
```

```bash
# From your local machine:
LICENSE_KEY="<paste from above>"
STAGING_URL="https://omniplug-cms-staging.fly.dev"

# Register WP site
curl -X POST $STAGING_URL/api/v1/wp-sites/register \
  -H "Content-Type: application/json" \
  -d "{
    \"license_key\": \"$LICENSE_KEY\",
    \"domain\": \"test-site.local\",
    \"wp_version\": \"6.5.2\",
    \"plugin_version\": \"0.1.0\",
    \"site_name\": \"Test Site\",
    \"admin_email\": \"test@example.com\"
  }"
# Expect 201 with { tenant_id, jwt, ... }

JWT="<paste jwt from response>"

# Send a fake bot crawl
curl -X POST $STAGING_URL/api/v1/bot-crawls/batch \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "test_001",
    "events": [{
      "bot_name": "ClaudeBot",
      "url_path": "/test/",
      "user_agent": "Mozilla/5.0 (compatible; ClaudeBot/1.0)",
      "ip_hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "crawled_at": "2026-05-23T10:00:00Z"
    }]
  }'
# Expect 202 with { accepted: 1 }

# Read it back
curl $STAGING_URL/api/v1/dashboard/summary \
  -H "Authorization: Bearer $JWT"
# Expect bot_activity.total_crawls_7d = 1
```

If all 3 calls return expected results: **backend is good**.

## Step 6 — Install WP plugin

```bash
# Option A: Local symlink (for dev)
cd /path/to/your/local-wordpress/wp-content/plugins
ln -s /path/to/quoted-mvp-v0.1.0/wp-plugin quoted

# Option B: Zip + upload (for staging/prod test)
cd /path/to/quoted-mvp-v0.1.0
cd wp-plugin && zip -r ../quoted.zip . -x "*.DS_Store" -x "languages/*.po" && cd ..
# Upload quoted.zip via WP Admin → Plugins → Add New → Upload Plugin
```

## Step 7 — Configure WP plugin

1. WP Admin → Plugins → activate Quoted
2. Quoted menu appears in left sidebar → click
3. Onboarding wizard step 1: paste backend URL (e.g. `https://omniplug-cms-staging.fly.dev`)
4. Step 2: paste license key
5. Click "Connect" → onboarding continues
6. Step 3: select niche from dropdown
7. Step 4: "Auto-scan top 20 posts" → wait ~30s
8. Done → dashboard appears

## Step 8 — Verify end-to-end

```bash
# Simulate a bot crawl on your WP site:
curl -A "ClaudeBot/1.0" http://your-wp-site.local/sample-post/

# Trigger WP-Cron manually (or wait 1 hour):
curl http://your-wp-site.local/wp-cron.php

# Check backend received it:
curl https://omniplug-cms-staging.fly.dev/api/v1/dashboard/summary \
  -H "Authorization: Bearer $JWT"
# Expect total_crawls_7d incremented

# Check llms.txt is generated:
curl http://your-wp-site.local/llms.txt
# Expect: markdown sitemap of your posts

# Check markdown endpoint:
curl http://your-wp-site.local/wp-json/quoted/v1/llm/sample-post
# Expect: clean markdown of the post
```

If all 4 verifications pass: **end-to-end is good. Ship to prod.**

---

## Production deploy checklist

Before flipping prod, run:

```bash
# OmniPlug pre-flight (10 checks)
fly ssh console -a omniplug-cms-prod
$ npm run preflight
# All 10 must pass

# Quoted additions checklist:
- [ ] Migrations 022-025 applied to prod DB
- [ ] All 5 new modules wired in server.js
- [ ] Smoke test 7 endpoints against prod URL
- [ ] First customer license issued (per OmniPlug RUNBOOK-LICENSING §2)
- [ ] Plugin tested on at least 3 PHP/WP version combos:
      - PHP 7.4 + WP 6.0
      - PHP 8.1 + WP 6.2
      - PHP 8.2 + WP 6.5
```

---

## Rollback procedure

If something breaks after deploy:

```bash
# 1. Revert backend
fly releases -a omniplug-cms-prod
fly deploy -a omniplug-cms-prod --image <previous-release-image>

# 2. Migrations are forward-only but additive. New tables won't break old code.
#    If you must drop the new tables (last resort):
fly ssh console -a omniplug-cms-prod
$ sqlite3 /data/omniplug.db
sqlite> DROP TABLE wp_sites; DROP TABLE bot_crawls;
sqlite> DROP TABLE citations; DROP TABLE notif_prefs;

# 3. Deactivate WP plugin on customer sites (manually or via update push)
```

---

## Monitoring

- Fly.io logs: `fly logs -a omniplug-cms-prod | grep quoted`
- Watch for these errors:
  - `quoted.register.failed` — license validation issues
  - `quoted.bot-crawls.dedup_overflow` — possible spam attack
  - `quoted.llms-content.cache_miss_storm` — Cloudflare cache failing
- BetterStack uptime checks against:
  - `https://omniplug-cms-prod.fly.dev/api/health`
  - `https://omniplug-cms-prod.fly.dev/api/public/llm/sitemap.txt` with test Host

---

## Notes

- Backups: OmniPlug's Litestream config covers new tables automatically.
- Logs: structured JSON, search by `tenant_id` in Fly log explorer.
- Costs at scale: see `docs/CITATION-TRACKING-SPEC.md` § Cost Model.
