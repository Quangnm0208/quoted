# Debugging Map

> Triage tree for the most likely failure modes. For deeper internals see [`DEBUGGING.md`](./DEBUGGING.md) and [`MODULE-MAP.md`](./MODULE-MAP.md).

## If website does not load

```
1. Front-end dev server up?
   npm run fe        # should show "Serving!"
   curl :5500/        → 200 expected
   ↓ if 404/connection refused
2. Static files present?
   ls frontend/index.html  → should exist
   ↓ if yes
3. Browser console errors?
   DevTools → Console → look for "Failed to fetch" / CORS errors
   ↓ if CORS error
4. CORS allow-list includes your origin?
   Check CORS_ORIGIN in backend/omniplug/.env
   should include http://localhost:5500 and http://127.0.0.1:5500
   ↓ if API errors
5. API base URL correct in cms.js?
   View source on index.html, find <script src="/assets/cms.js">
   Check <meta name="quoted-cms-api"> if production
6. Backend reachable?
   curl :4000/api/health    → expect {"status":"ok"}
```

## If CMS save does not update website

```
1. Save button gave a success toast?
   No → check DevTools Network for the PATCH request status
        ↓ if 401 → JWT expired → relogin
        ↓ if 400 → check inline error msg (usually bad JSON in payload)
        ↓ if 500 → check backend log: tail -f /tmp/be.log
   Yes → continue
2. Public API returns the new value?
   curl http://<api>/api/public/pages/quoted_home | jq '.sections[].payload'
   ↓ if old value persists → DB write failed silently?
   Check audit log (Admin → Audit Log) for page.section.update entry
   ↓ if new value present
3. Browser cache?
   Cmd-Shift-R / Ctrl-Shift-R (hard refresh)
   DevTools → Network → Disable cache → reload
   Wait up to 60s for the public API 60s cache to expire
4. Frontend hydration ran?
   DevTools → Network → find the /api/public/pages/quoted_home request
   ↓ if missing → cms.js didn't fire → check console errors / Body has data-cms-page attr
5. data-cms binding matches API key?
   View source on index.html, find data-cms attrs
   Compare data-cms="hero.eyebrow" against API payload key "eyebrow"
```

## If media does not load

```
1. File uploaded?
   curl with admin JWT: GET /api/admin/media → check rows
   ↓ if not present → upload failed (re-run with curl -v)
2. Public URL correct?
   Browser → http://<api>/uploads/<filename>
   ↓ if 404 → file not on disk → check UPLOAD_DIR
   ↓ if 403 → file permissions → chmod a+r
3. CORS for static uploads?
   Already set "Access-Control-Allow-Origin: *" by server.js
   Verify via: curl -I http://<api>/uploads/<filename> → look for ACAO header
4. <img src> path matches?
   Frontend HTML img src should match the public URL exactly
```

## If payment fails

```
1. Test mode flag correct?
   Dev: LEMONSQUEEZY_TEST_MODE=true → synthetic responses
   Prod: must be false → real LS roundtrip
   Check: flyctl secrets list -a quoted-api → look for LEMONSQUEEZY_TEST_MODE
2. API key valid?
   curl -H "Authorization: Bearer $LEMONSQUEEZY_API_KEY" https://api.lemonsqueezy.com/v1/me
   → expect 200 with seller info; 401 means revoked/wrong key
3. Variant ID matches?
   In LS dashboard, click variant → URL has /variants/<NUM> → must equal env LEMONSQUEEZY_VARIANT_*
4. Checkout URL accessible?
   Open the LEMONSQUEEZY_CHECKOUT_* URL in browser → should show LS hosted checkout
5. Backend checkout route reachable?
   curl -X POST -H "Content-Type: application/json" \
     -d '{"plan":"pro-monthly"}' \
     http://<api>/api/payments/checkout
   → expect {"checkout_url":"..."} with the variant's hosted URL
```

## If webhook fails

```
1. Webhook URL reachable from internet?
   curl https://api.<your-domain>/api/payments/webhook/lemon-squeezy -X POST -d '{}'
   → expect 401 (signature invalid) — proves route is mounted; if 404 you used wrong URL
2. LS dashboard shows webhook firing?
   LS Dashboard → Webhooks → click webhook → History tab
   Status 200 ✓ working
   Status 401 ✗ → secret mismatch
   Status 5xx ✗ → backend handler crashed
   Status timeout ✗ → backend slow or down
3. Signature secret match?
   LS Dashboard → webhook → Reveal Signing Secret
   Compare with: flyctl secrets list (just the name — value not shown)
   If unsure, regenerate via flyctl secrets unset + set
4. Raw body received correctly?
   server.js mounts express.raw before express.json — verify by checking commit
   If you've added body middleware, may break HMAC
5. Idempotency check working?
   curl -X POST -H "X-Signature: $sig" --data-binary @sample-event.json /webhook/...
   Send twice. First → process. Second → 200 ok (deduped). Check webhook_events table.
6. Event mapped to a handler?
   Only 6 events handled: order_created, subscription_created/cancelled/resumed/expired, license_key_created
   Other events return 200 + log "unhandled"
7. Handler logged audit entry?
   Admin → Audit Log → look for webhook.lemon-squeezy.received with the event_id
   No entry → handler crashed before audit; check backend log
```

## If admin login does not work

```
1. URL correct?
   /admin/login.html (not /admin/login or /admin)
2. Backend reachable?
   curl :4000/api/health → 200
3. Credentials correct?
   Dev default: admin@omniplug.local / ChangeMe123!
   Prod: set via ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD env (must override default)
4. Rate-limited?
   3 failed attempts = soft lock for 5 min
   Clear via: cd backend/omniplug && node -e "import db from './src/core/db/connection.js'; db.exec('DELETE FROM auth_attempts')"
5. JWT_SECRET present?
   flyctl secrets list -a quoted-api → JWT_SECRET should exist
   If missing → set + redeploy
```

## If admin page shows mock data / Vinhomes / old UI

```
1. Build stamp in sidebar footer says M2.1 or later?
   No → browser cache → Hard refresh; if still old → DevTools Network → Disable cache
2. /admin/assets/page-content.js has the new size?
   curl -I :4000/admin/assets/page-content.js → Content-Length should be ~28KB
3. server.js sends Cache-Control?
   curl -I :4000/admin/assets/page-content.js → look for "Cache-Control: no-cache, must-revalidate"
   If missing → backend not running latest code → restart
4. Repo on latest commit?
   git log --oneline -1 → should be ≥ commit bf06dd6 (v0.5.0 + numbered docs)
```

## If tests fail after pull

```
1. .env up to date?
   diff backend/omniplug/.env backend/omniplug/.env.example
   New required env vars from .env.example may need to be copied in
2. New migrations not applied?
   npm run migrate → applies any pending
3. node_modules stale?
   rm -rf */node_modules sdk/js-client/node_modules
   npm run bootstrap → reinstalls
4. PHP not installed?
   Run with: SKIP_PHP=1 npm test
5. Port 4000 busy?
   kill $(lsof -ti:4000) && npm test
```

## Where to get more context

| Doc | When to read |
|---|---|
| [`MODULE-MAP.md`](./MODULE-MAP.md) | "How does this part of the code work" — module-by-module trace |
| [`API-CONTRACT.md`](./API-CONTRACT.md) | Reference for any endpoint's request/response |
| [`DEBUGGING.md`](./DEBUGGING.md) | OmniPlug-level deep dive |
| [`12_BUG_LOG.md`](./12_BUG_LOG.md) | "Has this bug been seen before?" |
| [`ARCHITECTURE-COMMERCIAL.md`](./ARCHITECTURE-COMMERCIAL.md) | Payment/license/webhook flow detail |
