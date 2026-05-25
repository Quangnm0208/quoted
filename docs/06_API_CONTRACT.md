# 06 — API Contract

> **Canonical full reference:** [`API-CONTRACT.md`](./API-CONTRACT.md) — every endpoint with request/response.
> This file is the alignment status matrix only.

## Front-end ↔ back-end alignment (v0.5.0)

| Front-end caller | Method | Backend endpoint | Payload match | Response match | Auth | Status |
|---|---|---|---|---|---|---|
| `frontend/assets/cms.js` hydrator | GET | `/api/public/pages/quoted_home` | n/a | ✅ matches `{page, sections[]}` shape | none | ✅ |
| `frontend/assets/checkout.js` (if used) | POST | `/api/payments/checkout` | `{plan}` | `{checkout_url}` | none | ✅ T-PAY-1..3 |
| `frontend/success.html` query parse | GET | LS redirect callback | n/a | n/a | none | ✅ |
| `wp-plugin/includes/class-quoted-backend-client.php` `activate` | POST | `/api/v1/licenses/activate` | `{license_key, instance_id}` | `{activation_token, plan_id, features}` | none (key in body) | ✅ T-LIC-1..5 |
| `wp-plugin` `register` | POST | `/api/v1/wp-sites/register` | `{license_key, domain, site_name}` | `{jwt, plan, niche, ...}` | none (license=auth) | ✅ smoke |
| `wp-plugin` `posts/sync` | POST | `/api/v1/wp-sites/posts/sync` | `{posts:[...]}` | `{synced, skipped_over_quota}` | plugin JWT | ✅ smoke |
| `wp-plugin` `dashboard/summary` | GET | `/api/v1/dashboard/summary?days=N` | n/a | summary JSON | plugin JWT | ✅ smoke |
| `sdk/js-client` `products.plans` | GET | `/api/products/plans` | n/a | `[{plan_id, name, price, ...}]` | none | ✅ SDK smoke |
| `sdk/js-client` `payments.checkout` | POST | `/api/payments/checkout` | `{plan}` | `{checkout_url}` | none | ✅ SDK smoke |
| Admin shell `shell.js::api()` | various | `/api/admin/*` | varies | varies | JWT | ✅ M2 |
| Admin shell login | POST | `/api/auth/login` | `{email, password}` | `{token, user}` | none | ✅ |
| LS webhook (external) | POST | `/api/payments/webhook/lemon-squeezy` | LS payload (raw body) | `{ok}` | HMAC | ✅ T-PAY-4..9 |

## Standard response shapes

OmniPlug uses a flat shape, NOT the `{success, data, error, meta}` envelope from the master prompt template. Both consumers (browser + SDK) consume the flat shape directly. If we ever need envelopes, would wrap in a middleware — none required for v0.5.0.

### Success (typical)
```json
{ "page": "quoted_home", "sections": [...] }
{ "id": 5, "section_key": "hero", "title": "...", ... }
{ "rows": [...], "limit": 50, "offset": 0 }
```

### Error
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "value is required" } }
{ "error": { "code": "NOT_FOUND", "message": "Section not found" } }
{ "error": { "code": "DUPLICATE_SECTION", "message": "Section \"hero\" đã tồn tại trên trang \"quoted_home\"" } }
```

Used HTTP status codes:
- `200` success
- `201` created
- `400` validation
- `401` auth required
- `403` forbidden / quota
- `404` not found
- `409` conflict (duplicate)
- `413` payload too large (license body limit)
- `429` rate limited
- `500` server error

## API namespace rules (verified)

1. ✅ Public website → `/api/public/*` only (CMS pages, articles, leads submit)
2. ✅ CMS admin → `/api/admin/*` only (sections, site config, media, audit)
3. ✅ Front-end NEVER calls database directly (no DB driver in browser)
4. ✅ Front-end NEVER calls vendor APIs directly (Lemon Squeezy only touched server-side via adapter)
5. ✅ Admin routes require JWT (verified by `requireAuth` middleware)
6. ✅ Public routes expose no secrets (LS API key is server-only, scanned in T-PAY-3)
7. ✅ Errors use OmniPlug's `{error: {code, message}}` shape (consistent across modules)

## Adapter boundary check

| External system | Adapter file | Direct UI call possible? |
|---|---|---|
| Lemon Squeezy Checkout | `commerce/providers/lemon-squeezy/ls.checkout.adapter.js` | ❌ guarded — front-end can only call `/api/payments/checkout` |
| Lemon Squeezy Webhook | `commerce/providers/lemon-squeezy/ls.webhook.handler.js` | ❌ LS calls us; signature verified |
| Lemon Squeezy License API | `commerce/providers/lemon-squeezy/ls.license.client.js` | ❌ proxied through `/api/v1/licenses/*` |
| Future: Email provider | not yet implemented | will use `vendor.email.adapter.js` pattern |
