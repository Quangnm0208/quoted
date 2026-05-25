# 10 — Local Run

> Same content as `README.md` "Local run" section, formatted as a standalone reference for developers handed the ZIP.

## Pre-requisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 22.x | `node --version` → `v22.*` |
| npm | bundled with Node | `npm --version` |
| python3 | 3.8+ | for `better-sqlite3` native build |
| make + g++ | any | for `better-sqlite3` native build (`build-essential` on Debian/Ubuntu) |
| (optional) PHP | 8.0+ | for `npm test` to lint the WP plugin |

## Quick start

```bash
# 1. Install deps + copy .env + run migrations
npm run bootstrap     # ~2 min first time

# 2. Start backend (:4000) + frontend (:5500)
npm run dev

# 3. (optional) run every test suite
npm test              # 19/19 should pass
```

## Local URLs

| Service | URL | Auth | Notes |
|---|---|---|---|
| Marketing site | <http://127.0.0.1:5500/> | none | Hero + 6 promo cards CMS-driven; rest static |
| Pricing | <http://127.0.0.1:5500/pricing> | none | `serve` strips `.html` |
| Other static pages | `/docs`, `/faq`, `/blog`, `/changelog`, `/success` | none | |
| API health | <http://127.0.0.1:4000/api/health> | none | `{"status":"ok",...}` |
| Admin CMS | <http://127.0.0.1:4000/admin/> | login | Pages, Sections, Site Settings real save |
| Public sections API | <http://127.0.0.1:4000/api/public/pages/quoted_home> | none | Source of frontend hydration |
| Media uploads (static) | `http://127.0.0.1:4000/uploads/<filename>` | none | After upload via API |

## Admin login

| Field | Value (dev default) |
|---|---|
| URL | <http://127.0.0.1:4000/admin/login.html> |
| Email | `admin@omniplug.local` |
| Password | `ChangeMe123!` |

Sidebar footer shows `vX.Y.Z · admin build M2.1` — confirms fresh code, not stale browser cache.

## Expected success — what you should see

1. **Marketing site loads:** `http://127.0.0.1:5500/` returns 200, hero + 6 promotion cards visible.
2. **Backend healthy:** `curl :4000/api/health` returns `{"status":"ok"}`.
3. **Admin login works:** login UI accepts dev credentials, redirects to dashboard.
4. **Dashboard shows real counts:** Users / Tenants / Sections / Audit / Leads from DB (small numbers in dev).
5. **Pages page lists real sections:** `quoted_home` shown with `hero` + `programs` cards.
6. **Edit + Save works:** change Subtitle → Save → toast "Section đã lưu" → refresh `/` → see new text.
7. **Test suite green:** `npm test` → `19 pass, 0 fail`.

## Script reference (in root `package.json`)

| Script | What it does |
|---|---|
| `npm run bootstrap` | One-time: Node check, deps install (backend/frontend/sdk), `.env` from example, migrate, verify-schema |
| `npm run dev` | Start backend `:4000` + frontend `:5500` with `[BE]`/`[FE]` log prefixes; Ctrl-C kills both |
| `npm test` | Full suite: SQL lint + schema verify + 18 OmniPlug smoke + 8 OmniPlug regression + 15 commercial + 1 PHP + 4 SDK + 6 CMS-frontend |
| `npm run check` | SQL lint + schema verifier only (fast CI gate) |
| `npm run migrate` | Re-run DB migrations (useful after pulling new commits) |
| `npm run be` | Backend only in foreground |
| `npm run fe` | Frontend only in foreground |

## Common dev workflows

| Want to | Do |
|---|---|
| Edit a homepage section copy and see it live | Admin → Pages → `quoted_home` → expand `hero` → edit Subtitle → Save → hard-refresh `:5500/` |
| Add a new section to homepage | `curl POST /api/admin/pages/quoted_home/sections` with JWT (form UI for this is M3) |
| Test webhook locally | Use ngrok tunnel + LS webhook URL pointing to `http://YOUR-NGROK.io/api/payments/webhook/lemon-squeezy` |
| Reset to fresh seed | Delete `backend/omniplug/data/cms.db` + `npm run bootstrap` |
| Test plugin activation | Use signed envelope at `backend/omniplug/keys/marcus-outdoor.qtd-license.txt` (dev only) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE` on `:4000` or `:5500` | `kill $(lsof -ti:4000)` / `kill $(lsof -ti:5500)` |
| `better-sqlite3` install fails | Install build tools: `sudo apt install build-essential python3` |
| Admin shows old data after edit | Hard-refresh (Cmd-Shift-R) or DevTools → Network → Disable cache |
| `npm test` fails on PHP test | Install PHP 8+ or skip with `SKIP_PHP=1 npm test` (script gracefully skips if `php` missing) |
| Tenant `'localhost'` 404 in production-like mode | Backend in dev mode falls back to tenant 1; if you set `NODE_ENV=production` locally, you'll get strict 404 unless `tenants.domain` matches Host |
