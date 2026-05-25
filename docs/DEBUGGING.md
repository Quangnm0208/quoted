# Debugging Guide

Common failure modes during Phase 0 build + fixes.

---

## Backend issues

### "Module not found" on boot

**Symptom:** `node src/backend/server.js` throws `Cannot find module './modules/wp-sites/wp-sites.controller.js'`

**Cause:** Module files not copied or wrong path.

**Fix:**
```bash
ls /path/to/omniplug-cms-core/src/backend/modules/wp-sites/
# Should show: wp-sites.controller.js wp-sites.repository.js wp-sites.service.js
```

---

### "Migration 022 fails: column already exists"

**Symptom:** `Error: duplicate column name: wp_post_id`

**Cause:** Migration ran partially before. The shipped migrations are written
idempotent, but if you hand-applied SQL during debug, may be inconsistent.

**Fix:**
```bash
sqlite3 .test-data/load.db
sqlite> SELECT version FROM migrations ORDER BY version DESC LIMIT 5;
# If 022 is in the list but tables incomplete: manually drop and re-run.
sqlite> DELETE FROM migrations WHERE version = 22;
sqlite> DROP TABLE IF EXISTS wp_sites;
# Then re-run node src/core/db/migrate.js
```

---

### `wp-sites/register` returns 400 INVALID_LICENSE_FORMAT

**Symptom:** Plugin shows "Invalid license key format" on connect.

**Cause:** License key mistyped, or extra whitespace, or the LS webhook
hasn't reached our backend yet (the customer activated within seconds of
purchase and LS retry hasn't fired).

**Fix:**
1. Verify the key is a UUID in `8-4-4-4-12` format (Lemon Squeezy format,
   e.g. `8a7b6c5d-4e3f-2a1b-0c9d-1234567890ab`).
2. Check `webhook_events` in the backend DB — there should be a
   `license_key_created` row with `signature_valid=1, processed=1`.
3. If status is `LICENSE_NOT_YET_SYNCED` (503), wait 30s and retry — LS
   may have delayed the webhook. After 5 min, check LS webhook delivery
   log in the dashboard.
4. Check plugin is sending the key in `license_key` field (not `key`).

---

### `wp-sites/register` returns 403 DOMAIN_MISMATCH

**Symptom:** "License doesn't match domain"

**Cause:** License was issued for `example.com` but plugin sends `www.example.com`.

**Fix:** Backend normalizes (strips `www.`) before comparison. If still failing:
```bash
# Check license claim:
node scripts/op-license-decode.js <key>
# Compare claim.domain to the request's domain field exactly.
```

---

### Bot crawls accepted=0, deduped=N

**Symptom:** Every batch returns 0 accepted.

**Cause:** Either every event is a duplicate (same bot+url+minute), or
the unique index is misconfigured.

**Fix:**
```bash
sqlite3 /data/omniplug.db
sqlite> SELECT COUNT(*) FROM bot_crawls WHERE tenant_id = ?;
# If 0 rows: index is too strict. Inspect migration 023.
# If many rows: plugin is sending duplicates. Check WP plugin cron logic.
```

---

### `llms.txt` returns 404 for all domains

**Symptom:** `curl -H "Host: any-domain.com" .../api/public/llm/sitemap.txt` → 404

**Cause:** Tenant resolution failing.

**Fix:**
- Verify tenant exists with that domain: `sqlite> SELECT * FROM tenants WHERE domain = 'X';`
- Check OmniPlug's `tenantMiddleware` is mounted before the llms routes
- If you're calling via curl with a Host header, the backend may require
  the tenant to be marked `active=1`

---

### Markdown endpoint returns HTML with tags

**Symptom:** `.md` endpoint returns content with `<p>` and `<div>` tags.

**Cause:** Markdown serializer not invoked or buggy.

**Fix:**
- Confirm `markdown.serializer.js` is imported in `llms-content.controller.js`
- Check the serializer's regex/jsdom logic on a known sample
- If using jsdom and Node 20: `import { JSDOM } from 'jsdom';` works.
  If using Node 18: works too. Lower versions: install `jsdom@22` explicitly.

---

## WordPress plugin issues

### "Quoted" menu doesn't appear after activation

**Symptom:** Plugin shows as active but no admin menu item.

**Cause:** Hook not registered or capability check failing.

**Fix:**
1. Check user has `manage_options` capability (admin role required)
2. Look at WP debug.log for PHP fatal: `tail -f wp-content/debug.log`
3. Enable WP debug:
   ```php
   // wp-config.php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   define('WP_DEBUG_DISPLAY', false);
   ```

---

### "Backend unreachable" on onboarding step 1

**Symptom:** Step 1 → click Connect → "Cannot reach backend"

**Cause options:**
1. Backend URL typo (typo'd protocol, port, etc.)
2. CORS blocking — backend not configured to accept WP origin
3. Self-signed SSL cert — WP refuses to connect

**Fix:**
```bash
# From WP server, test backend reachability:
wp eval "var_dump(wp_remote_get('https://your-backend.fly.dev/api/health'));"
# Look at the response. If WP_Error: SSL or DNS issue.
# If 200 OK: backend is fine; check plugin's API client logic.
```

If self-signed SSL during dev:
```php
// In Quoted settings (dev only):
add_filter('https_ssl_verify', '__return_false');  // DEV ONLY, NEVER PROD
```

---

### llms.txt returns 404 on the WP site

**Symptom:** `curl http://your-site.local/llms.txt` → WP 404 page

**Cause:** Rewrite rules not flushed.

**Fix:**
```bash
wp rewrite flush
# Or in WP Admin: Settings → Permalinks → save (no changes needed)
```

If still 404:
- Verify `class-quoted-rest.php` registers the rewrite rule
- Verify the rule is loaded on `init`
- Check `wp_rewrite_rules` option contains your rule

---

### Bot crawls not appearing in dashboard

**Symptom:** Hit your site with `curl -A "ClaudeBot/1.0"`, dashboard still shows 0.

**Trace path:**

1. Is the bot detector running?
   ```bash
   wp eval "global \$wpdb; var_dump(\$wpdb->get_var('SELECT COUNT(*) FROM ' . \$wpdb->prefix . 'quoted_bot_log'));"
   # Should return >0 after a bot hit
   ```

2. Is the sync cron firing?
   ```bash
   wp cron event list | grep quoted
   # Should show quoted_sync_crawls scheduled
   wp cron event run quoted_sync_crawls
   # Force-run it; watch for errors
   ```

3. Did the backend receive?
   ```bash
   # On backend:
   sqlite> SELECT COUNT(*) FROM bot_crawls WHERE tenant_id = ?;
   ```

4. Does the dashboard query the right tenant?
   - Inspect Network tab in browser DevTools on dashboard load
   - Check JWT in request → decode at jwt.io → tenant_id matches

---

### "Powered by Quoted" badge missing on frontend

**Symptom:** Free tier should show badge; it's not rendering.

**Fix:**
- Verify plugin hooks into `wp_footer`
- Check theme calls `wp_footer()` in `footer.php`
- If theme is poorly built and skips `wp_footer()`, badge won't render.
  This is a known issue with some custom themes. We don't block on it.

---

### Onboarding flow takes more than 8 clicks

**Symptom:** Counted clicks; got 11.

**Cause:** Likely extra confirm dialogs or sub-steps in step 4 ("auto-scan").

**Fix:**
- Audit `admin/partials/onboarding.php` step transitions
- Remove any `confirm()` dialogs
- Remove any "Are you sure?" sub-prompts
- The 8-click flow is sacred — every extra click costs activation

---

## Integration issues

### Plugin works on staging, fails on customer's live site

**Common causes:**
1. **Object cache plugin (Redis Object Cache, W3 Total Cache):** May cache
   stale rewrite rules. Fix: flush WP object cache + rewrite rules on activation.

2. **Cloudflare in front:** May cache llms.txt with wrong headers. Fix:
   set `Cache-Control: public, max-age=300, s-maxage=86400` from plugin REST
   response. Cloudflare respects it.

3. **mod_security WAF on shared hosting:** May block bot user-agents in
   middleware. Fix: customer-side, ask hosting to whitelist ClaudeBot/GPTBot/etc.

4. **WP cron disabled:** Customer set `define('DISABLE_WP_CRON', true);`
   in wp-config. Fix: instruct them to set up real cron via cPanel, OR
   our plugin falls back to immediate sync on admin pageload.

---

### High CPU on customer site after install

**Symptom:** Customer reports site slow after activating Quoted.

**Cause hypotheses (in order of likelihood):**
1. `init` hook is doing too much
2. Bot detection running expensive regex on every request
3. Local log table not indexed

**Fix:**
- Profile with Query Monitor plugin
- Bot detection should be: 1 strpos check on user-agent against a small list
- If a customer's `wp_quoted_bot_log` table is >100K rows: indicate cron
  not running. Force flush.

---

## Smoke test commands (run after every change)

```bash
# Backend
cd /path/to/omniplug-cms-core
npm run lint
LOAD_DB_PATH=$(pwd)/.test-data/load.db node tests/regression-test.mjs
# Expect 36/36 still

# Plugin (PHP)
cd /path/to/quoted-mvp-v0.1.0/wp-plugin
phpcs --standard=WordPress .
# Expect 0 errors

# End-to-end (manual, 5 min)
1. Install fresh WP via Local
2. Activate Quoted plugin
3. Complete 8-click onboarding
4. curl -A "ClaudeBot/1.0" http://localhost:10003/
5. wp cron event run quoted_sync_crawls
6. Reload dashboard → should show 1 crawl
```

If all 6 manual steps work: ship.

---

## When you're truly stuck

1. **Reproduce in isolation.** Spin up bare WP, no other plugins, default
   theme. Does it work? If yes: conflict with customer's stack.

2. **Check OmniPlug logs first.** `fly logs -a omniplug-cms-prod | grep ERROR`

3. **Bisect.** If something worked yesterday and broke today: `git log`
   between then and now. Revert one change at a time.

4. **Ask for the customer's:**
   - WP version
   - PHP version
   - Active plugin list
   - Active theme name
   - Hosting provider
   - Last 50 lines of debug.log

5. **Last resort:** open a debug session over Zoom with the customer.
   Costs 30 min, saves 10 hours of guessing.
