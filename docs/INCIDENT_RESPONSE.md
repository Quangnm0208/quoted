# Incident Response Runbooks

> Per master-prompt section 6.19. One runbook per incident type.
> Goal: stop the bleed → restore service → root-cause → post-mortem.
> Audience: operator + DevOps. Most steps are CLI on Fly.io.

## General first-response (always do these)

1. **Stop the bleed.** Don't investigate first — contain.
   - If revenue affected → rotate secret / disable webhook URL at LS.
   - If admin compromised → reset password + rotate JWT (forces all admin re-login).
   - If site compromised → revoke plugin JWT for that site.
2. **Snapshot state.** `flyctl ssh console -a quoted-api` → `sqlite3 data/cms.db .dump > /tmp/snap-$(date +%s).sql`.
3. **Notify.** If >15min downtime or data loss → status page + customer email.
4. **Investigate** in a separate terminal while service is contained.
5. **Post-mortem within 48h** — what / why / how prevented / new test.

---

## Runbook 1 — Leaked API key (Lemon Squeezy)

**Symptom:** API key found in a public repo, log dump, screenshot, or anywhere it shouldn't be.

**Severity:** P0 — attacker can issue checkouts, create licenses, refund orders.

**Stop the bleed (≤5 min):**
1. LS dashboard → Settings → API → **Revoke** the leaked key
2. Generate new key → copy
3. `flyctl secrets set LEMONSQUEEZY_API_KEY="<new>" -a quoted-api` (auto-restart)
4. Verify: `curl https://api.quotedeasy.com/api/health` → 200

**Investigate:**
- LS dashboard → Logs → look for unfamiliar checkout/refund activity in last 24h
- `flyctl logs -a quoted-api | grep -E 'checkout|refund|lemonsqueezy'`
- Check `audit_log` table for unusual API activity timestamps

**Recover:**
- For each unauthorized order found: refund via LS dashboard; manually disable license in our DB
- Email affected customers if their billing was touched

**Prevent recurrence:**
- Add the file/screenshot/repo to `.gitignore` if applicable
- Run `bash scripts/check-no-secrets.sh` in pre-commit hook
- Confirm `.env` not in any release ZIP via `scripts/verify-release.sh`

---

## Runbook 2 — Leaked webhook secret

**Symptom:** `LEMONSQUEEZY_WEBHOOK_SECRET` exposed in logs / GitHub / screenshot.

**Severity:** P0 — attacker can forge webhook events to grant licenses or alter subscriptions.

**Stop the bleed (≤5 min):**
1. LS dashboard → Settings → Webhooks → click webhook → **Regenerate signing secret** → copy
2. `flyctl secrets set LEMONSQUEEZY_WEBHOOK_SECRET="<new>" -a quoted-api`
3. Verify next real webhook from LS arrives successfully (LS dashboard → Webhooks → History → 200)

**Investigate:**
- `SELECT * FROM webhook_events WHERE signature_valid=0 OR error_message IS NOT NULL ORDER BY received_at DESC LIMIT 50` — anything unexpected since leak?
- `SELECT * FROM customer_licenses WHERE created_at > '<leak time>'` — any licenses created during window?

**Recover:**
- For each suspicious license: cross-reference against LS dashboard `Orders`. If no matching real order, disable: `UPDATE customer_licenses SET status='revoked' WHERE id=?`

---

## Runbook 3 — Compromised admin account

**Symptom:** Unexpected admin actions in `audit_log` (section edits, license activations, etc.) from unknown IP.

**Severity:** P0 — full SaaS dashboard access including financial data.

**Stop the bleed (≤5 min):**
1. `flyctl ssh console -a quoted-api`
2. `cd /app && sqlite3 data/cms.db "UPDATE users SET is_active = 0 WHERE id = <compromised_user_id>"` — disables login
3. `flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)" -a quoted-api` — invalidates ALL admin sessions (forced re-login for everyone, including the attacker)

**Investigate:**
- `SELECT * FROM audit_log WHERE user_id=<id> ORDER BY created_at DESC LIMIT 100`
- `SELECT * FROM audit_log WHERE action='auth.login.success' AND user_id=<id> ORDER BY created_at DESC` — find suspicious IPs
- Cross-reference IP → geolocation; correlate with timestamps

**Recover:**
- Re-create admin user with new password: `INSERT INTO users (...) VALUES (...)` with bcrypt-hashed strong password (or `flyctl secrets set ADMIN_INITIAL_PASSWORD=<new>` then restart bootstrap)
- For every audit_log action the attacker took: review and revert (e.g. if they changed a section payload, restore from the previous audit entry's `metadata.before_value` if available, else from migration seed)

**Prevent recurrence:**
- Mandate 2FA on the operator email account (Gmail / Workspace)
- Add IP allowlist on `/admin/login.html` via Cloudflare rule (optional)

---

## Runbook 4 — License abuse wave

**Symptom:** `bot_crawls` show unusually high traffic from one customer, OR audit log shows many activations per hour on one license.

**Severity:** P1 — degraded service for other customers + plan cap circumvention.

**Stop the bleed (≤10 min):**
1. Identify the abusing license: `SELECT l.id, l.license_key_short, c.email FROM customer_licenses l JOIN customers c ON c.id = l.customer_id WHERE l.instances_count > l.activation_limit OR l.id IN (SELECT customer_license_id FROM wp_sites GROUP BY customer_license_id HAVING COUNT(*) > l.activation_limit)`
2. Disable: `UPDATE customer_licenses SET status='disabled' WHERE id=<id>`
3. Plugin polls will get `LICENSE_DISABLED` on next validate; sites stop syncing

**Investigate:**
- `SELECT domain, last_seen_at FROM wp_sites WHERE customer_license_id = <id>` — list all sites using this license
- Decide: refund customer + disable, or upgrade them to Agency plan and re-enable

**Recover:**
- Email customer; offer Agency upgrade or refund per policy
- If genuinely malicious (e.g. resellers): LS refund + permanent block

---

## Runbook 5 — Failed webhook backlog

**Symptom:** LS dashboard → Webhooks → History shows many non-200 responses (e.g. all 5xx after deploy).

**Severity:** P1 — every minute of backlog = lost subscription/license updates.

**Stop the bleed (≤15 min):**
1. `flyctl logs -a quoted-api | grep webhook` — what's the actual error?
2. If app crashed: `flyctl deploy --image registry.fly.io/quoted-api:deployment-<LAST_GOOD>` (rollback per `docs/16_ROLLBACK.md`)
3. If signature mismatch: check `LEMONSQUEEZY_WEBHOOK_SECRET` matches LS dashboard's current value
4. Once `/api/health` is 200 + secrets correct: LS dashboard → Webhooks → for each failed event → click **Resend**

**Investigate:**
- `SELECT * FROM webhook_events WHERE processed=0 ORDER BY received_at DESC` — anything saved-but-not-processed?
- `SELECT * FROM webhook_events WHERE signature_valid=0` — anything rejected during the window?

**Recover:**
- LS retries 3 times automatically; if you fix within 1 hour, most are recovered without manual resend
- For events older than LS retry window: replay via dashboard's "Resend" button per event
- After replay: verify `customer_licenses` + `subscriptions` tables have all expected rows for the time window

---

## Runbook 6 — Broken checkout

**Symptom:** Customers report "Start Pro" button doesn't take them to LS, OR LS checkout shows error.

**Severity:** P1 — direct revenue impact.

**Stop the bleed (≤10 min):**
1. Manually visit `https://quotedeasy.com/pricing` → click Start Pro → observe what happens
2. `curl https://api.quotedeasy.com/api/payments/checkout -X POST -H "Content-Type: application/json" -d '{"plan":"pro-monthly"}'` — expect `{checkout_url}`
3. If 500: check `flyctl logs` for adapter error
4. If returns URL but it's the wrong/dead one: `flyctl secrets list -a quoted-api | grep CHECKOUT` — compare against LS dashboard's variant Share URLs
5. Fix: `flyctl secrets set LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY="<correct>"  -a quoted-api`

**Communicate:** post "We're aware of checkout issue, fix incoming" on Twitter/email if downtime > 30min.

---

## Runbook 7 — Broken plugin activation

**Symptom:** Customer support tickets: "License Activate button fails".

**Severity:** P1 — blocks customer onboarding.

**Stop the bleed (≤15 min):**
1. Ask customer for: license key (paste into our backend), exact error message, screenshot
2. Reproduce: `curl -X POST https://api.quotedeasy.com/api/v1/licenses/activate -H "Content-Type: application/json" -d '{"license_key":"<their key>","site_url":"<their site>"}'`
3. Diagnose by error code:
   - `LICENSE_NOT_FOUND` → check `customer_licenses` for that hash; if missing, webhook hasn't arrived → check `webhook_events` for matching `license_key_created` event
   - `LICENSE_EXPIRED` → check `expires_at` vs current date
   - `LICENSE_DOMAIN_MISMATCH` → P0.2 doing its job; customer is trying to activate on wrong site
   - `LEMONSQUEEZY_TEST_MODE=true` warning → catastrophic; see Runbook 8
   - `LICENSE_NOT_YET_SYNCED` (503) → LS API unreachable; retry in 5min

**Recover:**
- If webhook missed: manually replay via LS dashboard → Webhooks → resend `license_key_created` event for that order
- If genuinely customer error (wrong site): help them activate on correct site

---

## Runbook 8 — Production booted in TEST_MODE

**Symptom:** Customers paying but receiving fake licenses; `customer_licenses` table not populating despite successful checkouts in LS.

**Severity:** P0 catastrophe — silent revenue loss + future customer fraud claims.

This SHOULD be impossible since v0.6.2 (env.js preflight blocks boot). If it happens, the guard was bypassed somehow.

**Stop the bleed (immediate):**
1. `flyctl secrets unset LEMONSQUEEZY_TEST_MODE -a quoted-api`
2. `flyctl deploy -a quoted-api` (forces restart with new config)
3. Verify: `curl https://api.quotedeasy.com/api/health` + check that test-mode is OFF: `flyctl secrets list -a quoted-api | grep TEST` → should show nothing

**Recover:**
- Pull list of customers who checked out during the bad window from LS dashboard → Orders
- For each: cross-reference our `customers` + `customer_licenses` tables. If license missing, replay webhook via LS → Webhooks → History → resend
- For each customer: email apology, confirm license issued, offer 1 month free

**Prevent recurrence:**
- Add monitoring alert: cron `curl /api/admin/quoted/dashboard` daily and alarm if `webhook_failures > 0` OR if any paid order has no matching license

---

## Runbook 9 — Production database issue (corruption / disk full / lost)

**Symptom:** `/api/health` returns 503; `flyctl logs` shows SQLite errors.

**Severity:** P0 — total outage.

**Stop the bleed (≤30 min):**
1. `flyctl ssh console -a quoted-api`
2. `df -h /app` — check disk; if full → `flyctl volumes extend <vol-id> -s <size+10>GB`
3. `sqlite3 /app/data/cms.db "PRAGMA integrity_check"` — confirms corruption
4. If corrupted: restore from Litestream (`docs/16_ROLLBACK.md` "Database rollback"). Expect data loss = time since last replication point (typically <1 min).
5. Restart: `flyctl apps restart quoted-api`

**Investigate:**
- Look at `flyctl logs` window before the failure — what changed?
- Check Litestream replication health: `litestream replicas /app/data/cms.db`

**Recover + post-mortem:**
- If data loss > 1 minute: identify gap, manually replay LS webhooks from LS dashboard for that window
- Increase Litestream sync frequency in `fly.toml` if disk allows

---

## Runbook 10 — Rollback procedure

For any production deploy that goes wrong → use `docs/16_ROLLBACK.md`. Summary:

```bash
# Backend
flyctl releases -a quoted-api
flyctl deploy --image registry.fly.io/quoted-api:deployment-<OLD_ID> -a quoted-api

# Frontend  (Cloudflare Pages UI)
Dashboard → Pages → quoted-marketing → Deployments → click old → "Rollback to this deployment"
```

---

## Communication templates

### Customer email — service incident
```
Subject: Quoted incident <date>: <one-line summary>

Hi <name>,

Between <start_time> and <end_time>, Quoted experienced <issue>.
Impact to you: <specific impact: license not delivered / site sync paused / charge double-counted>.

We've resolved the underlying cause: <one sentence>.
For your account specifically, we've <action taken: re-issued license / refunded duplicate / extended trial>.

If you see anything still wrong, reply to this email and we'll fix within 24h.

— Quoted team
```

### Status page update
```
[<status>] <one-line>

<2-3 sentence detail>

Workaround: <if any> | None required: we're handling it on our side.

Update times: every 30 min until resolved.
```

---

## Practice drills

Quarterly: pick one runbook, time yourself executing it on staging.
Track: time-to-detect, time-to-contain, time-to-recover.

Target SLOs:
- Detect (alerting → operator awareness): < 15 min
- Contain (stop the bleed): < 30 min
- Recover (restore service): < 2 hours
- Full post-mortem published: < 48 hours
