# 09 — Environment

> **Source of truth:** [`backend/omniplug/.env.example`](../backend/omniplug/.env.example) — has inline comments per key.

## File layout

| File | Status | Purpose |
|---|---|---|
| `backend/omniplug/.env.example` | ✅ shipped | Single template used for local + staging + production (one file by design — fewer drift surfaces) |
| `backend/omniplug/.env` | ✅ gitignored | Local copy created by `npm run bootstrap`. Never committed. |
| `.env.local.example`, `.env.staging.example`, `.env.production.example` | ❌ not split today | The single `.env.example` is documented per-environment via inline comments. Multi-file split deferred — `flyctl secrets` is the production source-of-truth, no production `.env` file needed. |

## Env key reference

Grouped per system. All present in `backend/omniplug/.env.example`.

### App identity
| Key | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `development` | `production` enables strict tenant resolution + telemetry |
| `PORT` | yes | `4000` | Backend HTTP port |
| `DB_PATH` | yes | `./data/cms.db` | SQLite file |

### Auth
| Key | Required | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | yes | dev placeholder | `openssl rand -hex 32` for production |
| `JWT_EXPIRES_IN` | no | `24h` | Admin session length |
| `BCRYPT_ROUNDS` | no | `10` | Password hash cost |
| `ADMIN_EMAIL` | yes | `admin@omniplug.local` | Initial admin email |
| `ADMIN_INITIAL_PASSWORD` | yes | `ChangeMe123!` | **MUST be overridden in production** (min 12 chars, not the default) |
| `ADMIN_DISPLAY_NAME` | no | `Admin` | |

### Tenant
| Key | Required | Default | Notes |
|---|---|---|---|
| `TENANT_DEFAULT_DOMAIN` | yes | `localhost` | Set to `api.quotedeasy.com` for production |
| `TENANT_DEFAULT_SLUG` | no | `demo` | |
| `TENANT_DEFAULT_NAME` | no | `Demo Tenant` | |

### CORS
| Key | Required | Default | Notes |
|---|---|---|---|
| `CORS_ORIGIN` | yes (prod) | dev list | Comma-separated origins; includes `:5500` dev frontend |

### Media
| Key | Required | Default | Notes |
|---|---|---|---|
| `UPLOAD_DIR` | no | `./uploads` | Local disk; Fly persistent volume in prod |
| `UPLOAD_PUBLIC_URL` | no | `/uploads` | URL prefix |
| `UPLOAD_MAX_SIZE` | no | `3145728` | 3MB |

### Audit / retention
| Key | Required | Default | Notes |
|---|---|---|---|
| `AUDIT_LOG_RETENTION_DAYS` | no | `180` | Prune on startup |
| `LEAD_RATE_LIMIT_PER_HOUR` | no | `20` | |
| `TRUST_PROXY` | no | `false` | Set `true` behind Fly/Cloudflare so `req.ip` is correct |

### Feature flags
| Key | Default | Used by |
|---|---|---|
| `FEATURE_ARTICLES` | `true` | Articles module |
| `FEATURE_PROJECTS` | `true` | Projects module (unused by Quoted) |
| `FEATURE_LEADS` | `true` | Leads module |
| `FEATURE_MEDIA` | `true` | Media module |
| `FEATURE_SDK`, `FEATURE_WEBHOOKS`, `FEATURE_API_KEYS`, `FEATURE_CRM` | `false` | reserved |

### License
| Key | Required | Default | Notes |
|---|---|---|---|
| `LICENSE_ENFORCEMENT` | yes | `warn` | `strict` in production after smoke test passes |
| `LICENSE_PUBLIC_KEY_PATH` | yes | `keys/op-license-pub.pem` | RSA-4096+ public key |

### Telemetry
| Key | Default | Notes |
|---|---|---|
| `TELEMETRY_ENABLED` | `true` | Phone-home heartbeat to OmniPlug — set false to disable |
| `OMNIPLUG_TELEMETRY_URL` | upstream default | Override for self-hosted telemetry receiver |

### Quoted overlay
| Key | Default | Notes |
|---|---|---|
| `QUOTED_JWT_TTL_HOURS` | `24` | Plugin-side JWT lifetime |
| `QUOTED_FREE_POST_LIMIT` | `50` | Free-tier post quota per WP site |
| `QUOTED_BOT_CRAWL_RETENTION_DAYS` | `90` | Bot crawl log retention |

### Lemon Squeezy (commercial)
| Key | Required (prod) | Notes |
|---|---|---|
| `LEMONSQUEEZY_TEST_MODE` | yes | `true` dev/CI; **MUST be `false` in production** |
| `LEMONSQUEEZY_API_KEY` | yes (prod) | From LS Settings → API |
| `LEMONSQUEEZY_STORE_ID` | yes (prod) | From LS dashboard URL |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | yes (prod) | Revealed when webhook created |
| `LEMONSQUEEZY_VARIANT_PRO_MONTHLY/YEARLY` | yes (prod) | Variant ID per pricing tier |
| `LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY/YEARLY` | yes (prod) | |
| `LEMONSQUEEZY_CHECKOUT_*` | yes (prod) | Hosted checkout URL per variant |

## Rules (enforced)

| Rule | How |
|---|---|
| No real secrets committed | `.env` in `.gitignore`; `.env.example` only |
| No production URL hardcoded | All URLs from env (`APP_URL`/`API_URL`/`CORS_ORIGIN`/checkout URLs) |
| No live payment in local | `LEMONSQUEEZY_TEST_MODE=true` default in dev |
| Missing required env fails clearly | `env.js` validates on boot; `verify-schema.js` confirms after migrate |
| Env docs explain every key | Inline comments in `.env.example` per key |

## Production secret rotation

```bash
# Rotate JWT (forces all admin re-login)
flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)" -a quoted-api

# Rotate webhook (must update LS dashboard simultaneously!)
flyctl secrets unset LEMONSQUEEZY_WEBHOOK_SECRET -a quoted-api
flyctl secrets set LEMONSQUEEZY_WEBHOOK_SECRET="whsec_new..." -a quoted-api
```

(Production: `.env` doesn't exist on Fly — secrets injected as environment variables by the platform.)
