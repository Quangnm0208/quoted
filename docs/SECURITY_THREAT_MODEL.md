# Security Threat Model — Quoted SaaS

> Concrete threats × current defenses. Per master-prompt section 6.1.
> Last updated: 2026-05-25 (v0.6.2 + P1 cancel-fix).

## Assets being protected

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Customer identity (email, name) | medium-PII | `customers` table |
| Billing data (orders, amounts) | medium — financial | `orders`, `subscriptions` tables |
| License keys | **high** — entitlement | `customer_licenses` (key_hash + short prefix only) |
| Activation tokens | high — short-lived | JWT, in-memory + plugin-side only |
| Plugin JWTs | high — site auth | `wp_sites` table + plugin storage |
| Tenant content (synced WP posts) | medium | `quoted_posts` table |
| Bot crawl / citation analytics | low — derived | `bot_crawls`, `citations` |
| Webhook payloads | medium — billing truth | `webhook_events` raw_payload |
| Operator dashboard | high — exposes all-customer financial data | `/api/admin/quoted/*` |
| Production secrets | **critical** | env vars (`flyctl secrets`), never DB or code |
| Admin password | critical | bcrypt-hashed in `users.password_hash` |

## Threat table

| Threat | Example exploit scenario | Severity | Current defense | Status |
|---|---|---|---|---|
| **T1 — License key abuse** | Customer buys Pro for 1 site, then uses same key on 10 sites | high | `customer_licenses.activation_limit` (LS-enforced); domain binding on activation token (P0.2); per-domain entitlement check | ✅ |
| **T2 — Token replay across domains** | Attacker phishes/leaks an activation token issued for site A and uses it on their own site B | high | Token includes `normalized_domain`; `validate` rejects 403 `LICENSE_DOMAIN_MISMATCH` on mismatch (P0.2 v0.6.2) | ✅ |
| **T3 — Cross-tenant data leak (SaaS admin)** | Customer who is an admin of *their own* tenant somehow obtains a token, queries `/api/admin/quoted/customers` and sees all SaaS customers | high | `requirePlatformAdmin` middleware (P0.1 v0.6.2) enforces `tenant_id=1 AND role=admin`; 403 PLATFORM_ADMIN_REQUIRED otherwise | ✅ |
| **T4 — Cross-tenant data leak (CMS data)** | Tenant A admin reads tenant B's articles/sites/leads | high | `requireAuth + resolveTenantFromAuth` middleware binds `req.tenantId` from JWT; every repo query is `WHERE tenant_id = ?`; SQL-pattern lint enforces | ✅ |
| **T5 — Webhook spoofing (fake payment)** | Attacker POSTs fake "subscription_created" to `/api/payments/webhook/lemon-squeezy` to grant themselves a license | critical | Raw-body HMAC SHA-256 verification against `LEMONSQUEEZY_WEBHOOK_SECRET`; empty secret → fail-closed (P0.4 v0.6.2: production refuses to boot without it) | ✅ |
| **T6 — Webhook replay** | Network-mitm replays old `subscription_created` event to create duplicate customer/order | medium | `webhook_events` table dedupes by `(provider, event_id)`; second insert is a UNIQUE conflict → 200 idempotent reply, no side-effect | ✅ |
| **T7 — Cancellation bypass via partial failure** | Customer cancels subscription; webhook upserts subscription metadata but variant_id is unknown (e.g. operator rotated variants) → handler throws, transaction rolls back, customer stays "active" | high | v0.6.2 fix: split upsert + disable; upsert is best-effort, disable always runs; logged warning. Live-verified | ✅ |
| **T8 — Brute-force license activation** | Attacker iterates random license keys against `/api/v1/licenses/activate` | medium | `activateRateLimit` middleware: 5/hour/IP via `rateLimiterIp.js`; failed attempts logged to `auth_attempts` table | ✅ |
| **T9 — Brute-force WP site registration** | Attacker spams `/api/v1/wp-sites/register` with random license keys | medium | `registerRateLimit` middleware: 5/hour/IP | ✅ |
| **T10 — Plugin compromise → malicious sync** | Attacker compromises a customer's WP site, uses the plugin JWT to write arbitrary posts to backend | low (scoped to own site) | Plugin JWT bound to `(tenant_id, wp_site_id)` from registration; sync only writes for that site; no cross-site mutation | ✅ |
| **T11 — Secret leak in frontend/plugin** | LS API key accidentally bundled in marketing site JS or WP plugin PHP | critical | All vendor calls are server-only via `commerce/providers/lemon-squeezy/*.adapter.js`; T-PAY-3 test scans checkout response for API key; `scripts/check-no-secrets.sh` scans releases | ✅ |
| **T12 — XSS in admin via stored customer field** | Customer signs up with name `<img src=x onerror=...>`; admin opens customers page; JS runs in admin context | medium | `shell.js::escapeHtml()` entity-encodes every dynamic value rendered; verified live (audit phase 8.4) | ✅ |
| **T13 — SQL injection via admin query param** | Attacker (somehow authenticated) sends `?limit=1; DROP TABLE customers; --` | high (if exploited) | All queries use parameterized `db.prepare(?)` — never string concat; `?limit/offset/days` parsed via `parseInt` + clamped before use; `scripts/check-sql-patterns.mjs` lints for forbidden patterns | ✅ |
| **T14 — Dependency supply-chain attack** | Compromised npm package gets push access to production via post-install script | medium | `package-lock.json` committed; `npm audit --production` in `verify-release.sh`; no unusual post-install scripts | ⏳ recurring (audit monthly) |
| **T15 — Misconfigured production (TEST_MODE on)** | Operator copy-pastes dev `.env` to production; customers pay but get synthetic LS responses | critical | `env.js` boot preflight (P0.4 v0.6.2): production + `LEMONSQUEEZY_TEST_MODE=true` → throws clear error + refuses to start. Same for missing webhook secret. | ✅ |
| **T16 — Cloudflare proxy modifies webhook body** | If Cloudflare orange-cloud proxy is enabled on `api.*` with SSL mode "Flexible", body would be re-serialized → HMAC fails on all webhooks | medium operational | Documented in `docs/15_DOMAIN_DNS_SSL.md`: `api.*` MUST be DNS-only (grey cloud) OR SSL mode = "Full (strict)" | ✅ documented |
| **T17 — Admin password default never rotated** | Operator deploys with `ADMIN_INITIAL_PASSWORD=ChangeMe123!`; anyone with that default + URL can login | critical | `env.js` boot preflight rejects `ChangeMe123!` in production + requires ≥12 chars; `LAUNCH-HANDOFF.md` + `GO_LIVE_GUIDE.md` step 9 require rotation | ✅ |
| **T18 — JWT secret weak / reused across envs** | Same `JWT_SECRET` in dev + prod → dev token forges prod admin session | high | `env.js` requires `JWT_SECRET` length ≥ 32 in production; deploy doc requires `openssl rand -hex 32` per env | ✅ |
| **T19 — Open redirect via checkout URL config** | Attacker tricks operator into setting `LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY=https://attacker.com` | low (operator has env write access) | Env values are trusted by definition — if attacker has env write access, they own the host. Documented in `SECURITY_REVIEW.md` | ✅ accepted |
| **T20 — Public LLM endpoint tenant bleed** | `/api/public/llm/sitemap.txt` resolves wrong tenant from spoofed `X-Quoted-Domain` header → serves another customer's content | medium | LLM controller looks up `wp_sites WHERE domain = ?` — only registered sites can serve content; unknown domain returns "Site not registered" (verified live) | ✅ |

## Defense layers (defense-in-depth)

```
Internet
   ↓
Cloudflare (rate-limit, DDoS, bot management)  — optional, recommended
   ↓
TLS (Let's Encrypt via Fly)
   ↓
Helmet middleware (CSP, HSTS, no-sniff, frame-ancestors)
   ↓
Path-specific middleware:
   /api/payments/webhook → raw body + HMAC verify
   /api/v1/* → requireAuth (plugin JWT) + license gate + rate-limit
   /api/admin/* → requireAuth (admin JWT) + resolveTenantFromAuth
   /api/admin/quoted/* → ALSO requirePlatformAdmin
   /api/public/llm → controller-internal domain resolve
   /api/public/* → resolveTenantFromHost
   ↓
Controller-level validation (zod / parse + clamp)
   ↓
Service layer (business rules)
   ↓
Repository layer (parameterized SQL, tenant_id filter mandatory)
   ↓
SQLite WAL + Litestream backup
```

## Audit trail

Every security-relevant action writes a row to `audit_log`:

- `auth.login.success` / `auth.login.fail` / `auth.login.deactivated`
- `auth.login.tenant_inactive` / `auth.login.role_not_enabled`
- `page.section.update` / `site.config.update`
- `webhook.lemon-squeezy.received` (with event_name + event_id)
- license activation success / failure (via licenses module)

Operator can review via `/admin/audit.html` (admin UI) or `GET /api/admin/audit`.

## Not yet implemented (deferred to v0.6.3+)

| Threat | Status | Roadmap |
|---|---|---|
| **T8/T9 enhanced** — per-license + per-domain rate limit (not just per-IP) | ⏳ IP-only today | M3.1 — add license_id-keyed bucket |
| **T6 enhanced** — separate `webhook_failures` table for failed processing visibility | ⏳ partial — `webhook_events.error_message` exists, no dedicated table | M3.2 — break out + add admin alert |
| **T10 enhanced** — plugin JWT revocation list (force-disconnect a compromised site) | ⏳ no manual revocation API | M3.3 — add `POST /api/admin/quoted/wp-sites/:id/revoke` |
| **T20 enhanced** — per-domain rate limit on `/api/public/llm/*` | ⏳ no rate limit on public LLM | M4 — add when traffic warrants |
| **Multi-region** — secrets rotation across regions | ⏳ single-region (Fly sin or iad) | when scaling |
| **CSP report-uri** — collect CSP violations | ⏳ static CSP | when CSP tuning needed |
| **Sentry / error monitoring** | ⏳ console.error only | optional pre-launch |

## Review schedule

- **Per release:** run `scripts/security-smoke.sh` + `scripts/check-no-secrets.sh` + this doc grep
- **Monthly:** `npm audit --production` + review npm dep updates
- **Quarterly:** re-walk this threat table + update for new attack surfaces
- **On incident:** see `INCIDENT_RESPONSE.md`
