# Deployment Guide — Quoted v0.4.0 (Commercial)

Three independent surfaces to deploy:

1. **Backend** (Node + SQLite) → Fly.io
2. **Frontend** (static HTML) → Cloudflare Pages
3. **WordPress plugin** (PHP) → WordPress.org submission

Each can ship without the others. The minimum bar for a paying customer to
get value is: backend deployed + WP plugin distributed via wordpress.org.
Marketing site can be `quotedeasy.com` standalone or even hand-served while
you iterate copy.

---

## Prerequisites

- Fly.io account, `flyctl` installed, app name `quoted-api` (or your chosen)
- Cloudflare account with `quotedeasy.com` DNS already pointed at CF
- Lemon Squeezy seller account (or test mode store)
- Node 22, `npm`, `php` for local verification

---

## 1. Lemon Squeezy setup (one-time, ~15 min)

In the Lemon Squeezy dashboard:

1. **Store → API → Create access token** (only needs read/write on
   licenses + checkouts; do NOT grant payments scope). Copy the token.
2. **Products → New** → name "Quoted Pro", description, single image.
   Add 2 variants: Monthly $19, Yearly $190. **License keys → enabled.**
   Activation limit = 1 (Pro). Copy each variant's numeric ID from URL.
3. **Products → New** → name "Quoted Agency". Variants Monthly $29, Yearly $290.
   Activation limit = 5 (Agency). Copy variant IDs.
4. For each variant: **Share → Hosted Checkout** → copy the URL.
   Append `?aff_ref=…` later if affiliate tracking is added.
5. **Webhooks → New webhook**
   - URL: `https://api.<your-domain>/api/payments/webhook/lemon-squeezy`
     (use Fly.io app URL until custom domain is set: `https://<app>.fly.dev/...`)
   - Events to subscribe (check all): `order_created`, `subscription_created`,
     `subscription_updated`, `subscription_cancelled`, `subscription_expired`,
     `subscription_resumed`, `license_key_created`, `license_key_updated`.
   - **Reveal signing secret**, copy it (this is `LEMONSQUEEZY_WEBHOOK_SECRET`).

---

## 2. Backend (Fly.io)

```bash
cd backend/omniplug
flyctl launch --no-deploy   # only if first time; otherwise skip
flyctl secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  ADMIN_EMAIL=admin@quotedeasy.com \
  ADMIN_INITIAL_PASSWORD="$(openssl rand -base64 24)" \
  CORS_ORIGIN="https://quotedeasy.com,https://www.quotedeasy.com" \
  TENANT_DEFAULT_DOMAIN=api.quotedeasy.com \
  LEMONSQUEEZY_API_KEY="eyJ0..." \
  LEMONSQUEEZY_STORE_ID=12345 \
  LEMONSQUEEZY_WEBHOOK_SECRET="whsec_..." \
  LEMONSQUEEZY_VARIANT_PRO_MONTHLY=11111 \
  LEMONSQUEEZY_VARIANT_PRO_YEARLY=11112 \
  LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY=11113 \
  LEMONSQUEEZY_VARIANT_AGENCY_YEARLY=11114 \
  LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  LEMONSQUEEZY_CHECKOUT_PRO_YEARLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  LEMONSQUEEZY_CHECKOUT_AGENCY_MONTHLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  LEMONSQUEEZY_CHECKOUT_AGENCY_YEARLY="https://quotedeasy.lemonsqueezy.com/checkout/buy/xxxx" \
  APP_BASE_URL="https://quotedeasy.com" \
  API_BASE_URL="https://api.quotedeasy.com"
flyctl deploy
```

**Critical:** do NOT set `LEMONSQUEEZY_TEST_MODE=true` in production —
it short-circuits the LS License API roundtrip with synthetic success
responses. Test mode is for local dev + CI only.

Verify after deploy:
```bash
curl -s https://<app>.fly.dev/api/health | jq
curl -s https://<app>.fly.dev/api/products/plans | jq
```

Custom domain:
```bash
flyctl certs create api.quotedeasy.com
# Point DNS: api.quotedeasy.com A → fly app IPv4
```

---

## 3. Frontend (Cloudflare Pages)

### Option A — Connect GitHub (recommended)

1. Cloudflare dashboard → Pages → Create project → Connect Git → `muahangngayvn/quoted`
2. Production branch: `main` (or your release branch)
3. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `frontend`
4. Save and deploy. First deploy URL is `<project>.pages.dev`.
5. Custom domain: Pages project → Custom domains → Set up → `quotedeasy.com`. Cloudflare auto-provisions cert.

### Option B — Direct upload (no CI)

```bash
cd frontend
# Cloudflare Wrangler (one-time: npm i -g wrangler && wrangler login)
wrangler pages deploy . --project-name=quoted-website
```

`_headers` and `_redirects` are picked up automatically — no extra config.

Verify:
- `curl -I https://quotedeasy.com/` should return `200 OK` + the CSP header.
- `https://quotedeasy.com/pricing` (no `.html`) should render.
- "Start Pro" button click should POST to `https://api.quotedeasy.com/api/payments/checkout`.

---

## 4. WordPress plugin (wordpress.org submission)

```bash
cd /path/to/quoted
zip -r quoted-0.4.0.zip wp-plugin/ \
  -x "wp-plugin/.git/*" \
  -x "*.DS_Store" \
  -x "wp-plugin/tests/*"
```

Upload to wordpress.org via Plugin Directory → Add Your Plugin (or the SVN
flow if you're already approved). The plugin defaults to
`QUOTED_BACKEND_URL = https://api.quotedeasy.com` (set in
`class-quoted-backend-client.php::DEFAULT_BASE_URL`). For self-hosted
deployments, the operator can override via WP option `quoted_backend_url`
or the constant `QUOTED_BACKEND_URL` in `wp-config.php`.

---

## 5. Verification — end-to-end test against production

1. Open `https://quotedeasy.com/pricing` in an incognito window.
2. Click "Start Pro" → redirected to LS hosted checkout.
3. Pay with a Lemon Squeezy test card (`4242 4242 4242 4242`).
4. Confirm redirect to `https://quotedeasy.com/success.html`.
5. Check inbox for receipt + license key (UUID).
6. Open a clean WordPress install, install the plugin, paste the UUID,
   click Activate. The admin badge should turn green and show "Pro".
7. Publish a post. Visit `https://your-wp-site.example/llms.txt` —
   it should list the post.
8. Check Fly.io logs: `flyctl logs -a quoted-api` — you should see the
   webhook payload arrive, the license activate call, and the
   wp-sites/register call.

---

## 6. Secret rotation

| Secret | Rotate procedure | Blast radius |
|---|---|---|
| `JWT_SECRET` | `flyctl secrets set JWT_SECRET=$(openssl rand -hex 32) && flyctl deploy` | All plugin JWTs + activation tokens invalidated. WP plugins re-activate on next cron (within 24h). |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | LS dashboard → Webhooks → Regenerate. Then `flyctl secrets set ...`. Window: ~2 min where both old and new are accepted (set new, deploy, then disable old in LS). | Webhooks signed with old secret rejected (401). |
| `LEMONSQUEEZY_API_KEY` | LS dashboard → API → Revoke + Create new. `flyctl secrets set ...`. | License activate/validate/deactivate temporarily fail until new key is deployed. |
| `ADMIN_INITIAL_PASSWORD` | Only seeded once on first boot. To rotate: log into admin and change via UI. | None — the env var is consulted only when no admin user exists. |

---

## 7. Rollback

If the commercial layer breaks production:

```bash
flyctl releases list -a quoted-api
flyctl releases rollback <previous-release-id> -a quoted-api
```

WordPress installs that have already activated continue working via stored
tokens — `/posts/sync` and `/dashboard/summary` are unaffected by the
payments/licenses modules. Only new activations fail with a clean error
the admin UI surfaces.

Migration rollback: SQLite has no native ALTER TABLE DROP COLUMN. Schema
migrations 030-036 are forward-only. The data they create is contained in
new tables (deletable with care) — see `docs/RUNBOOK.md` (TBD) for the
manual rollback SQL if ever needed.
