# 08 — Integrations / Payment / Webhooks Report

> **Canonical architecture:** [`ARCHITECTURE-COMMERCIAL.md`](./ARCHITECTURE-COMMERCIAL.md) — Mode A vs B rationale, full data-flow diagram.
> This file is the integration-status matrix only.

## Integration status (v0.5.0)

| Area | Status | Evidence |
|---|---|---|
| Payment provider adapter (Lemon Squeezy) | ✅ live | `backend/omniplug/src/backend/modules/commerce/providers/lemon-squeezy/ls.checkout.adapter.js` |
| Sandbox checkout | ✅ T-PAY-1..3 pass | `quoted-test-payments-checkout.mjs` |
| Webhook endpoint | ✅ mounted | `POST /api/payments/webhook/lemon-squeezy` at `server.js:408` |
| Webhook raw-body parsing | ✅ before global JSON parser | `server.js:210` mounts raw body parser BEFORE `express.json()` |
| Webhook HMAC signature verification | ✅ verified against `LEMONSQUEEZY_WEBHOOK_SECRET` | `ls.webhook.handler.js::verifySignature()` |
| Webhook idempotency | ✅ deduped by event_id in `webhook_events` table | `commerce/providers/lemon-squeezy/ls.webhook.idempotency.js` |
| Webhook event mapping | ✅ 6 events handled | order_created, subscription_created/cancelled/resumed/expired, license_key_created |
| Webhook audit log | ✅ every event recorded | audit_log entry `webhook.lemon-squeezy.received` |
| License activation | ✅ T-LIC-1..5 pass | `quoted-test-licenses-activation.mjs` |
| License proxy (server-only) | ✅ no LS keys in WP plugin or front-end | `wp-plugin/includes/class-quoted-backend-client.php` only talks to our backend |
| Entitlement upsert on webhook | ✅ creates/updates `entitlements` row | `ls.webhook.handler.js::handleSubscriptionUpsert()` |
| Plan → variant mapping | ✅ env-driven | `LEMONSQUEEZY_VARIANT_*` map to internal `pro-monthly` etc. |
| Test mode (synthetic LS) | ✅ guarded behind `LEMONSQUEEZY_TEST_MODE=true` | `ls.license.client.js::activate()` short-circuits in test mode |
| Live payment lock | ✅ `LEMONSQUEEZY_TEST_MODE=false` REQUIRED in production | documented in env.example + LAUNCH-HANDOFF + GO_LIVE_GUIDE |
| Vendor API adapters (email/CRM/analytics) | ❌ not implemented | not in scope for v0.5.0 — feature flags exist |

## Plan mapping (v0.5.0)

| Public plan ID | Provider variant ID env | Internal plan tag | Entitlement features | Status |
|---|---|---|---|---|
| `pro-monthly` | `LEMONSQUEEZY_VARIANT_PRO_MONTHLY` | `pro` | bot tracking, llms.txt, markdown serializer | ✅ |
| `pro-yearly` | `LEMONSQUEEZY_VARIANT_PRO_YEARLY` | `pro` | same | ✅ |
| `agency-monthly` | `LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY` | `agency` | pro + multi-site + partner page | ✅ |
| `agency-yearly` | `LEMONSQUEEZY_VARIANT_AGENCY_YEARLY` | `agency` | same | ✅ |
| Free (implicit) | n/a — auto-assigned to fresh sites | `free` | basic only, 50-post cap (`QUOTED_FREE_POST_LIMIT`) | ✅ |

## Webhook flow (verified)

```
Lemon Squeezy
   ↓ POST raw body + X-Signature
/api/payments/webhook/lemon-squeezy
   ↓ verifySignature(raw, secret) via HMAC SHA-256
   ↓ if invalid → 401 "INVALID_SIGNATURE"
parseEventId(payload)
   ↓ check webhook_events table for duplicate
   ↓ if seen → 200 ok (idempotent)
INSERT webhook_events (raw + status=processing)
   ↓
dispatch by event_name → handler
   ↓ order_created → upsert customer + order
   ↓ subscription_* → upsert subscription + entitlement
   ↓ license_key_created → upsert license + entitlement
   ↓
recordAudit('webhook.lemon-squeezy.received', {event_id, event_name})
UPDATE webhook_events SET status='processed'
   ↓
200 OK to LS
```

Any handler exception → status='failed' + raise → LS retries (LS retries with exponential backoff).

## Feature flags (in `.env.example`)

```env
PAYMENT_PROVIDER=lemonsqueezy
PAYMENT_MODE=sandbox           # informational
LEMONSQUEEZY_TEST_MODE=true    # MUST be false in production
```

(Master prompt suggests `FEATURE_LIVE_PAYMENT` — same intent, different naming. Backend honours `LEMONSQUEEZY_TEST_MODE`. Could rename for consistency in a future commit but not blocking.)

## Vendor APIs not integrated (deferred)

| Vendor | Env var stub | Use case | Roadmap |
|---|---|---|---|
| Email | `EMAIL_PROVIDER`, `EMAIL_API_KEY` | Transactional emails on lead/order | when contact form added |
| CRM | `CRM_PROVIDER`, `CRM_API_KEY` | Sync leads to operator's CRM | optional, operator-defined |
| Analytics | `ANALYTICS_PROVIDER`, `ANALYTICS_API_KEY` | Server-side event tracking | optional |

Env keys exist as stubs in `.env.example`. Adapter modules will follow the same pattern as `commerce/providers/lemon-squeezy/` when implemented.
