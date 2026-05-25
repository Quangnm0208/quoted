# Architecture Decision Record — Commercial Layer (v0.4.0)

**Status:** Accepted
**Date:** 2026-05-25
**Supersedes:** the qtd_(live\|test)_* envelope flow described in API-CONTRACT.md §"Plugin authentication" (now removed).

---

## Context

Quoted has three surfaces that historically had three different ideas about how a customer turns money into working software:

1. **Marketing site** (`frontend/`) — static, calls nothing, "Start Pro" linked to WP.org Free.
2. **WordPress plugin** (`wp-plugin/`) — called `api.lemonsqueezy.com/v1/licenses/*` directly with a customer UUID, held no concept of "our backend."
3. **Backend overlay** (`backend/omniplug/src/backend/modules/wp-sites/`) — implemented a self-signed `qtd_live_<jwt>` license envelope flow, RSA-4096, intended to be issued by a Quoted-operator signing script. **Zero consumers.**

The audit at `docs/SYSTEM-AUDIT.md` flagged this as the #1 release blocker: the backend overlay was orphaned code in production.

## Decision

Three separations, one direction of trust:

```
SALES               PAYMENTS              RUNTIME
[Marketing site] → [LS hosted checkout] → [LS webhook] → [our backend] → [plugin]
                                                         ↑               ↓
                                                         └───────────────┘
                                                         /licenses/{activate,validate,deactivate}
                                                         (backend proxies LS License API)
```

### 1. Sales = static marketing site
Frontend's only responsibility is to convert visitors to clicks on a checkout CTA. Pricing CTAs POST `{plan}` to `/api/payments/checkout`. Backend returns an LS hosted-checkout URL; the browser redirects.

### 2. Payments = backend, never plugin or frontend
- Backend owns `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_WEBHOOK_SECRET`.
- Plugin holds **zero** LS credentials. Even the License API call goes through us.
- Frontend holds **zero** LS credentials. Checkout URL is the only LS-domain string it ever sees, and it's per-request, not embedded.

### 3. Webhook = source of truth for entitlement
LS webhook → `/api/payments/webhook/lemon-squeezy` → HMAC verify → idempotent insert into `webhook_events` (event_id UNIQUE) → dispatch per `event_name`:

| LS event | Effect on our DB |
|---|---|
| `order_created` | upsert `customers`, insert `orders` |
| `subscription_created/updated/resumed` | upsert `customers`, upsert `subscriptions` |
| `subscription_cancelled/expired` | upsert subscription + `entitlements.status = disabled` |
| `license_key_created/updated` | upsert `customer_licenses`, upsert `entitlements` |

Entitlement is the cached "what is this customer allowed to do" record. The plugin reads it via `/api/v1/licenses/validate`.

### 4. Plugin activation = LS-proxy
Plugin POSTs `{license_key, site_url}` to `/api/v1/licenses/activate`. Backend:
1. Hashes the key, looks up `customer_licenses`.
2. Calls LS License API to activate the instance (LS is authoritative for `instances_count`).
3. Mints an HS256 `activation_token` (24h TTL) carrying `{customer_id, license_id, plan_id, site_url}`.
4. Returns `{activation_token, plan, plan_tier, features, expires_at, activation_limit, instances_count}`.

The plugin uses `activation_token` for `/validate` (daily cron) and `/deactivate`. After activate, the plugin auto-calls `/api/v1/wp-sites/register` with the token to obtain a separate plugin JWT used for the runtime endpoints (`/posts/sync`, `/bot-crawls/batch`, `/dashboard/summary`).

## Why LS-proxy over hybrid or LS-direct

We considered three license models (see session log 2026-05-25):

| Model | License source | Plugin ↔ LS direct | Notes |
|---|---|---|---|
| **LS-proxy (chosen)** | LS UUID | No | Simplest. Plugin only knows our backend. Webhook is our source of truth. |
| Hybrid (our JWT + LS payment) | Quoted RSA-signed JWT | No | More code, more control, plugin works offline. Wins on the offline angle, but we didn't have a real offline use case. |
| LS-direct | LS UUID | Yes | Plugin carries no secret (LS validate doesn't need API key) but couples plugin to LS API surface. Violates "plugin doesn't own payment" cleanly. |

LS-proxy wins because:
- **Plugin holds zero LS keys.** Future LS API changes only touch our backend.
- **One license vocabulary.** No need to maintain both LS UUID and our `qtd_live_*` envelope.
- **Webhook centralises business logic.** Plan changes, refunds, subscription pauses all flow through one server.

Cost: backend is required for activation. We accept that — production already requires the backend for `/posts/sync` and `/dashboard/summary`.

## Why Mode A (hosted URL) over Mode B (API-generated checkout)

Mode A = env carries hosted checkout URLs. Mode B = backend calls LS Create Checkout API per request.

Mode A wins for MVP because:
- No LS API call on the conversion path (faster, no LS downtime risk).
- LS hosted checkout supports `?checkout[email]=` prefill via URL param — covers the only Mode-B advantage we cared about.
- Mode B is one config swap away: `plans.config.js` already declares `variant_env` alongside `checkout_env`. The first plan that needs custom_data per checkout (e.g. agency reseller markup) flips that plan to Mode B without refactoring the controller.

## Why Cloudflare Pages over Vercel or OmniPlug /web

- Free tier, no cold start, edge cache, no build step.
- `_headers` and `_redirects` files are first-class — we use them for CSP + pretty URLs.
- Custom domain via DNS only.

Vercel was rejected because the frontend has no framework — Vercel's edge functions are wasted on pure HTML. Serving from OmniPlug was rejected because it would mix marketing CPU with API CPU and force a single domain.

## What changed in code

**New modules:**
- `backend/omniplug/src/backend/modules/payments/` — checkout + webhook + LS client + entitlement repo + plans config.
- `backend/omniplug/src/backend/modules/licenses/` — activate/validate/deactivate proxy.

**New schema:** `backend/omniplug/src/core/db/migrations/030_quoted_customers.sql` through `036_quoted_wp_sites_link.sql`.

**Frontend:** `frontend/success.html`, `frontend/assets/checkout.js`, `frontend/_headers`, `frontend/_redirects`. Pro/Agency CTAs gain `data-checkout-plan` attributes.

**WP plugin:** `wp-plugin/includes/class-quoted-license.php` rewritten (288 → 203 lines). New helper `wp-plugin/includes/class-quoted-backend-client.php`.

**Removed:**
- `qtd_live_*` envelope verify path in `wp-sites/quoted-licenses.js` (only `signPluginJwt` kept).
- The legacy `license_key` field on `/api/v1/wp-sites/register` — replaced by `activation_token`.

## Trust assumptions

1. **`JWT_SECRET` is the only secret needed to forge a plugin JWT or activation token.** Rotation invalidates all sessions; documented in `docs/DEPLOYMENT.md`.
2. **`LEMONSQUEEZY_WEBHOOK_SECRET`** is the only secret needed to forge a webhook. Rotate in LS dashboard + `flyctl secrets set` in the same window.
3. **`LEMONSQUEEZY_API_KEY`** stays server-side. The CSP `connect-src` on the frontend doesn't include `api.lemonsqueezy.com` — only our API.
4. The activation_token does NOT carry the license key. It only carries `{customer_id, license_id, plan_id, site_url}` — even a leaked token can only validate/deactivate that one site instance.

## Rollback plan

If `/api/payments/*` or `/api/v1/licenses/*` is broken in production:
1. Revert the `server.js` mounts (4-line revert of the commercial-layer block).
2. WordPress installs that have already activated continue working via their stored `activation_token` + `quoted_plugin_jwt` — `/posts/sync` and `/dashboard/summary` are unaffected.
3. New activations fail with a graceful error in the admin UI. Customers can re-activate after the fix.
