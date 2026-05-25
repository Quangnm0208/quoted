# BUG FIX LOG — Quoted SaaS Admin v0.6.0 → v0.6.1

> Comprehensive audit (`AUDIT_REPORT.md`) found **zero P0 / P1 / P2 bugs**.
> This file documents the audit's three "findings" that turned out to be
> false positives + the rationale, so the next reviewer doesn't re-flag
> them.

## Bug #1 — `/api/admin/quoted/bot-crawls` response shape

**Severity:** false positive
**Area:** api-shape

**Symptom:** Initial audit assertion expected every `/api/admin/quoted/*` endpoint to return `{rows: []}` on empty DB. The `bot-crawls` endpoint instead returns `{days, total, by_bot, by_day, top_sites}`.

**Reproduction:**
```bash
curl -H "Authorization: Bearer $TOKEN" /api/admin/quoted/bot-crawls
# → {"days":7,"total":0,"by_bot":[],"by_day":[],"top_sites":[]}
```

**Root cause:** The endpoint is intentionally an aggregated analytics view (top bots / top sites / by-day chart-friendly), not a row list. The frontend `renderBotCrawls` renderer expects this exact aggregate shape — see `page-content.js` line ~580 where it iterates `d.by_bot`, `d.by_day`, `d.top_sites`.

**Fix:** None required. Audit assertion was over-generalized.

**Files changed:** None.

**Status:** ✅ Not a bug — closing.

---

## Bug #2 — Webhook returns 401 even with HMAC signature

**Severity:** false positive
**Area:** webhook-sig

**Symptom:** Audit script computed HMAC-SHA256 with `LEMONSQUEEZY_WEBHOOK_SECRET` from `.env`, sent in `X-Signature` header, but server returned `401 {"error":{"code":"BAD_SIGNATURE","message":"Signature mismatch"}}`.

**Reproduction:**
```bash
# In a fresh-bootstrap repo where .env has LEMONSQUEEZY_WEBHOOK_SECRET=
PAYLOAD='{"meta":{"event_name":"order_created","webhook_id":"x"},"data":{}}'
SIG=$(node -e "console.log(require('crypto').createHmac('sha256','').update(process.argv[1]).digest('hex'))" "$PAYLOAD")
curl -X POST -H "X-Signature: $SIG" --data "$PAYLOAD" /api/payments/webhook/lemon-squeezy
# → 401 BAD_SIGNATURE
```

**Root cause:** `backend/omniplug/src/backend/modules/commerce/providers/lemon-squeezy/index.js:21`

```js
verifyWebhookSignature(rawBody, headers) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;   // ← fail-closed when no secret configured
  ...
}
```

This is **correct fail-closed security behavior**: when no webhook secret is configured (default `.env.example` ships with empty value for safety), the server refuses to process any webhook. This prevents an attacker from sending unsigned webhooks during initial setup.

The official webhook tests (`tests/quoted-test-payments-webhook.mjs`) use `{ skip: !SECRET }` on every test to skip when secret is empty. The audit script omitted this skip.

**Fix:** None required. Server behavior is correct. Audit script was incomplete.

To verify webhook flow actually works, audit was re-run with `LEMONSQUEEZY_WEBHOOK_SECRET="audit-secret-12345"`:
- ✅ valid HMAC → 200
- ✅ same event_id redelivery → 200 (idempotent, only 1 row in `webhook_events`)
- ✅ bad signature → 401
- ✅ customer created in DB
- ✅ order created in DB
- ✅ dashboard reflects revenue

**Files changed:** None.

**Status:** ✅ Not a bug — closing.

---

## Bug #3 — Webhook redelivery returns 401 too

**Severity:** false positive (consequence of #2)
**Area:** webhook-idem

**Symptom:** Same as #2 — without a configured secret, idempotency check never runs because the request is rejected at signature verification.

**Reproduction:** Same as #2.

**Root cause:** Same as #2 — fail-closed when `LEMONSQUEEZY_WEBHOOK_SECRET=''`.

**Verification idempotency does work** (with secret configured):
```
First delivery:  200, webhook_events table: 1 row
Redelivery:      200, webhook_events table: 1 row (no duplicate)
Customer count:  1   (no duplicate customer created)
Order count:     1   (no duplicate order)
```

**Files changed:** None.

**Status:** ✅ Not a bug — closing.

---

## Real fixes already landed in earlier session commits

For completeness, these P0/P1 bugs were found + fixed in this session **before** the v0.6.0 audit:

| Commit | Bug | Severity |
|---|---|---|
| `c219a62` | `LEMONSQUEEZY_TEST_MODE=false` default contradicted README + broke 3 tests | P1 |
| `c219a62` | `CORS_ORIGIN` missing `:5500` blocked CMS hydration | P1 |
| `c219a62` | Empty `LEMONSQUEEZY_CHECKOUT_*` URLs broke SDK + checkout | P1 |
| `8dc83e7` | Admin UI was 505 LoC Vinhomes mockup with 0 fetch calls | P1 |
| `8dc83e7` | `pages.html` had `data-page="sections"` typo + no `pages:` renderer | P1 |
| `6a4cb96` | Three remaining vinhomes hardcodes in sidebar (email/brand/role) | P2 |
| `6a4cb96` | `/admin/*` static had no `Cache-Control` → stale JS in browser | P2 |
| `6a4cb96` | Login placeholder `admin@vinhomes.vn` | P3 |
| `9a0c75d` | Cold-start race + rate-limit accumulation between test suites | P3 (DX) |

All retest-green; full record in `docs/12_BUG_LOG.md`.

## Conclusion

v0.6.0 → v0.6.1 audit finds **no new bugs**. Tag and ship.
