# Module map — Quoted v0.4.0

A reading guide to the codebase. Each "chapter" has memory + continuity:
modules don't reach across surface boundaries except through documented
seams.

```
┌─────────────────────────────────────────────────────────────────┐
│                        SALES SURFACE                             │
│  frontend/                static marketing + checkout CTA        │
│    ├── *.html             6 pages + success + 404                │
│    ├── assets/checkout.js  POSTs to /api/payments/checkout       │
│    └── _headers _redirects Cloudflare Pages config               │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS (no shared code)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Fly.io)                          │
│  backend/omniplug/src/                                           │
│    ├── core/              UPSTREAM OmniPlug v1.4.4 (don't touch) │
│    │   ├── config/  db/  lib/  middleware/                       │
│    ├── backend/                                                  │
│    │   ├── server.js      route wiring                           │
│    │   └── modules/                                              │
│    │       ├── (24 upstream modules — articles, leads, …)        │
│    │       ├── _contracts/      single source of truth for       │
│    │       │                    request/response shapes (SDK)    │
│    │       ├── plugin-runtime/  what the WP plugin Bearer-JWT    │
│    │       │   ├── _shared/       plugin-auth, quoted-posts repo │
│    │       │   ├── wp-sites/      register/refresh/sync/dashboard│
│    │       │   ├── bot-crawls/    hourly batch ingestion         │
│    │       │   ├── citations/     Phase 0 stub                   │
│    │       │   ├── live-ai-test/  Phase 0 stub                   │
│    │       │   └── llms-content/  public llms.txt + per-post md  │
│    │       └── commerce/        sales + activation               │
│    │           ├── plans/         canonical plan catalogue       │
│    │           ├── entitlements/  customer/order/sub/lic repo    │
│    │           ├── payments/      vendor-agnostic checkout +     │
│    │           │                  webhook controller             │
│    │           ├── licenses/      vendor-agnostic activate/      │
│    │           │                  validate/deactivate            │
│    │           └── providers/     PaymentProvider impls          │
│    │               ├── _interface.md   contract docs             │
│    │               ├── index.js        registry                  │
│    │               └── lemon-squeezy/  LS impl                   │
│    └── cms/admin/         OmniPlug admin UI (upstream)           │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS (no shared code)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  WP Plugin       │ │  @quoted/sdk     │ │  Future SDKs     │
│  (PHP)           │ │  (npm)           │ │  (Python, Go, …) │
│  wp-plugin/      │ │  sdk/js-client/  │ │  sdk/<lang>/     │
│                  │ │                  │ │                  │
│  - backend-client│ │  - QuotedClient  │ │                  │
│  - license       │ │  - QuotedError   │ │                  │
│  - admin UI      │ │  - typed         │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Dependency rules (enforced by reading the import graph, not by lint)

1. **upstream → overlay: forbidden.** Upstream OmniPlug modules
   (articles, leads, tenants, …) never import from `plugin-runtime/`,
   `commerce/`, or `_contracts/`. This keeps OmniPlug upgrades clean
   (`cp -r v1.5/src/* …` overwrites only the upstream half).
2. **overlay → upstream: through `core/lib/*` only.** Quoted modules
   use `core/lib/{tenancy, jwt, rateLimiterIp}.js`, `core/db/connection.js`,
   `core/middleware/*.js`. Nothing else.
3. **plugin-runtime → commerce: allowed** (wp-sites needs entitlement on
   `/register`).
4. **commerce → plugin-runtime: forbidden.** Commerce is purely server-side
   — payments and licenses never reach into plugin-runtime.
5. **plugin-runtime → plugin-runtime/_shared: allowed.** _shared owns the
   plugin-auth middleware + quoted-posts repository that 4+ modules need.
6. **commerce → commerce/providers: allowed.** Other commerce/* modules
   import from `providers/index.js`, never from individual providers.
7. **Anything → _contracts: allowed.** Contracts is the SDK foundation.

## How to add a new feature

| New feature | Where it lands | What you touch |
|---|---|---|
| Stripe (or any 2nd payment vendor) | `commerce/providers/stripe/` | implement PaymentProvider, register in `providers/index.js`, add `LEMONSQUEEZY_*` style env vars. **Zero other files.** |
| Slack notification on new purchase | new `commerce/notifications/slack/` | subscribe to `webhook_events` table or import `entitlementRepo` to listen. New cron or webhook subscriber. |
| Python SDK | new `sdk/python-client/` | `pip install quoted` — mirror @quoted/sdk surface. Same contracts. |
| New runtime endpoint (e.g. `/wp-sites/restore`) | extend `plugin-runtime/wp-sites/wp-sites.controller.js` | add route + schema in `_contracts/` + update `@quoted/sdk` |
| New plan tier (e.g. "team-monthly") | extend `commerce/plans/plans.config.js` + add 2 env vars (`LEMONSQUEEZY_VARIANT_TEAM_MONTHLY`, `LEMONSQUEEZY_CHECKOUT_TEAM_MONTHLY`) | nothing else |
| Plugin-side UI: feature gate | read `quoted_features` option in `wp-plugin/admin/partials/*.php` | no backend change needed |

## How to trace a bug

| Symptom | First file to open | Then |
|---|---|---|
| Customer can't activate (UI shows error) | `wp-plugin/includes/class-quoted-license.php` | trace WP_Error code → `commerce/licenses/licenses.service.js` |
| Webhook silently failed | `webhook_events` table in DB (filter by `processed = 0`) | `commerce/providers/<vendor>/<vendor>.webhook.handler.js` |
| Checkout button does nothing | `frontend/assets/checkout.js` | network tab → `commerce/payments/payments.controller.js` |
| Plugin says "not connected" but option is set | `wp-plugin/includes/class-quoted-license.php::validate` | check `quoted_license_status` value |
| llms.txt returns 404 for known site | `plugin-runtime/llms-content/llms-content.controller.js` | `tenants` table — is the domain registered? |
| Dashboard score wrong | `plugin-runtime/wp-sites/wp-sites.service.js::computeScore` | inputs: `bot-crawls` + `quoted-posts` repos |

## Tests by area

| Area | File | Lock down |
|---|---|---|
| Upstream OmniPlug | `tests/test-fix-*.mjs` (8 files) + `scripts/smoke.js` | core API + auth + tenant isolation |
| Payments checkout | `tests/quoted-test-payments-checkout.mjs` | shape + plan validation + secret-leak |
| Webhook | `tests/quoted-test-payments-webhook.mjs` | HMAC verify + idempotency + per-event handlers |
| Licenses | `tests/quoted-test-licenses-activation.mjs` | activate/validate/deactivate + activation_limit |
| End-to-end | `tests/quoted-test-e2e-purchase-to-activation.mjs` | full purchase → site registration flow |
| Response shape | `tests/quoted-test-regression-snapshot.mjs` | every public endpoint, breaks on field rename |
| WP plugin PHP | `wp-plugin/tests/test-license-activation.php` | 25 assertions — activate/validate/deactivate, error mapping, options |
| SDK | `sdk/js-client/test/smoke.test.mjs` | typed client wraps the wire correctly |

Total: 5 mjs + 8 mjs + 1 php = 14 test files, 60+ assertions.
