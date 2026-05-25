# 14 — Deployment

> **Canonical command-by-command reference:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) — `flyctl` recipes, Cloudflare Pages config, custom domain, certificate.
> **CEO-friendly linear walkthrough:** [`GO_LIVE_GUIDE.md`](./GO_LIVE_GUIDE.md).
> This file is a status summary only.

## Deploy targets (recommended)

| Surface | Target | Cost | Setup time |
|---|---|---|---|
| Backend API | Fly.io | ~$5-10/mo | 15 min |
| Marketing site | Cloudflare Pages | FREE | 10 min |
| DNS + SSL | Cloudflare | FREE | 5 min |
| Domain registration | Cloudflare Registrar | ~$10/yr | 10 min |
| Database | included in backend (SQLite + Litestream) | — | — |
| Media storage | Fly persistent volume | included | — |
| Payment | Lemon Squeezy seller account | 5% per txn | 15 min |

**Total: ~2-3 hours of work for a complete launch.**

## Deployment readiness

| Requirement | Status | Notes |
|---|---|---|
| `Dockerfile` for backend | ✅ | `backend/omniplug/Dockerfile` |
| `fly.toml` | ✅ | `backend/omniplug/fly.toml` |
| Frontend has no build step | ✅ | Static HTML; Cloudflare Pages serves direct |
| `_headers` + `_redirects` for Pages | ✅ | `frontend/_headers`, `frontend/_redirects` |
| Production env documented | ✅ | `09_ENVIRONMENT.md` + `.env.example` inline |
| `flyctl secrets set` recipe | ✅ | `DEPLOYMENT.md` section 2 + `GO_LIVE_GUIDE.md` step 3 |
| Custom domain steps | ✅ | both docs |
| Webhook URL pattern | ✅ | `https://api.<domain>/api/payments/webhook/lemon-squeezy` |
| Tenant domain config | ✅ | `TENANT_DEFAULT_DOMAIN` env |
| CORS for production | ✅ | `CORS_ORIGIN` env, multiple origins allowed |
| Telemetry opt-out documented | ✅ | `TELEMETRY_ENABLED=false` |

## Deploy command reference (short form)

```bash
# Backend (from backend/omniplug/)
flyctl launch --no-deploy       # first time only
flyctl secrets set ...          # see GO_LIVE_GUIDE step 3.3 + 7.5
flyctl deploy

# Backend custom domain
flyctl certs create api.YOURDOMAIN.com -a quoted-api
# then add Cloudflare A+AAAA records (DNS only, not proxied)

# Frontend: connect GitHub repo to Cloudflare Pages dashboard, root=frontend/, no build command
# Custom domain via Pages settings → Custom domains
```

For full step-by-step including LS webhook config and smoke test, see [`GO_LIVE_GUIDE.md`](./GO_LIVE_GUIDE.md).

## Post-deploy smoke test (1 of 11 from GO_LIVE_GUIDE)

```bash
# Backend health
curl https://api.YOURDOMAIN.com/api/health
# → {"status":"ok","version":"1.4.4",...}

# Public sections API
curl https://api.YOURDOMAIN.com/api/public/pages/quoted_home
# → {"page":"quoted_home","sections":[{key:"hero",...},{key:"programs",...}]}

# Plans API (validates LS config)
curl https://api.YOURDOMAIN.com/api/products/plans
# → 4 plans with hosted_url
```

## Rollback

See [`16_ROLLBACK.md`](./16_ROLLBACK.md).
