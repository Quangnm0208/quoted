# Quoted MVP v0.1.0 — AI Citation Plugin for WordPress

**Owner:** Nguyễn Mạnh Quang &lt;quangnm0208@gmail.com&gt;
**Status:** Phase 0 scaffold — production-bound, not yet deployed
**Date packaged:** 2026-05-23

This package contains the complete buildable scaffold for the Quoted product:
a WordPress plugin (PHP) + backend extensions to the existing OmniPlug CMS Core
(Node.js) that together let WP site operators make their content AI-readable,
track AI bot activity, and surface citations from Perplexity / ChatGPT / Claude.

---

## What's in this repo

```
quoted/
├── README.md                  ← you are here
├── LICENSE.txt
├── NOTICE.txt
├── CHANGELOG.md
│
├── docs/                      ← Strategy + architecture docs
│   ├── PHASE-0-BUILD-PLAN.md
│   ├── CITATION-TRACKING-SPEC.md
│   ├── ARCHITECTURE.md
│   ├── API-CONTRACT.md
│   ├── DEPLOYMENT.md
│   └── DEBUGGING.md
│
├── wp-plugin/                 ← WordPress plugin (PHP)
│   ├── quoted.php
│   ├── includes/  admin/  public/  languages/
│   └── readme.txt
│
├── backend/                   ← Node.js API (OmniPlug + Quoted overlay)
│   ├── README.md              ← Overlay layout + rules
│   └── omniplug/              ← OmniPlug CMS Core v1.4.4 vendored with the
│                              quoted overlay applied in-place. This is the
│                              runnable backend. See its package.json.
│
├── frontend/                  ← Static marketing site (HTML/CSS/JS, no bundler)
│   ├── package.json           ← `npm run dev` → `serve` on :5500
│   ├── index.html  pricing.html  docs.html  faq.html  blog.html  changelog.html
│   └── assets/  README.md
│
└── tests/
    ├── wp-plugin-tests.md
    └── backend-tests.md
```

---

## Local run — one terminal each

You need **Node 22.x** (the backend pins `>=22 <24`). Check with `node --version`.

### Terminal 1 — Backend (port 4000)

```bash
cd backend/omniplug
npm install                                  # one-time
# .env ships with safe local defaults; LICENSE_PUBLIC_KEY_PATH points at
# keys/op-license-pub.pem. To generate a fresh keypair instead, see "License
# keys" below.
node --env-file=.env src/core/db/migrate.js  # runs migrations 001-029
node --env-file=.env scripts/verify-schema.js
node --env-file=.env src/backend/server.js   # boots on :4000
```

Visit:
- Admin UI: <http://localhost:4000/admin/> — login `admin@quoted.local` / `ChangeMe123!`
- Health: <http://localhost:4000/api/health>

### Terminal 2 — Frontend (port 5500)

```bash
cd frontend
npm install                                  # one-time
npm run dev                                  # serve on :5500
```

Visit:
- <http://localhost:5500/> — Home
- <http://localhost:5500/pricing> — `serve` strips the `.html`
- <http://localhost:5500/docs> · `/faq` · `/blog` · `/changelog`

The marketing site is fully static — it does NOT call the backend today (by
design — the brief was to integrate the existing pieces, not add a new fetch
layer). When/if `pricing`, `faq`, `changelog`, etc. are made CMS-driven, the
landmarks in `frontend/README.md` show where to wire each section.

---

## License keys (local dev)

The repo ships an operator public key at `backend/omniplug/keys/op-license-pub.pem`
and a test license envelope at `backend/omniplug/keys/marcus-outdoor.qtd-license.txt`
for domain `marcus-outdoor.test`. Use those for smoke tests.

To regenerate from scratch:

```bash
cd backend/omniplug
node scripts/op-key-generate.js --rsa --basename=keys/op-license-rsa
cp keys/op-license-rsa.pub.pem keys/op-license-pub.pem      # the server trusts this

node scripts/qtd-license-sign.js \
  --priv=keys/op-license-rsa.priv.pem \
  --signed-for=marcus-outdoor.test \
  --plan=lite \
  --customer-email=ops@marcus-outdoor.test \
  --expires-in-days=365 \
  --env=test \
  --out=keys/marcus-outdoor.qtd-license.txt
```

The `qtd_test_…` envelope written to the `--out` file is what the Quoted WP
plugin pastes into its **Settings → License key** field. The private key is
gitignored and must stay off the repo (operator-managed).

---

## Smoke tests (backend already running)

```bash
# 1. Register the test domain
LICENSE=$(cat backend/omniplug/keys/marcus-outdoor.qtd-license.txt)
curl -s -X POST http://localhost:4000/api/v1/wp-sites/register \
  -H "Content-Type: application/json" \
  -d "{\"license_key\":\"$LICENSE\",\"domain\":\"marcus-outdoor.test\",\"site_name\":\"Marcus Outdoor\"}" \
  | tee /tmp/register.json

JWT=$(python3 -c "import json; print(json.load(open('/tmp/register.json'))['jwt'])")

# 2. Sync a post
curl -s -X POST http://localhost:4000/api/v1/wp-sites/posts/sync \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"posts":[{"wp_post_id":1,"slug":"hello","title":"Hello","content_html":"<p>Hi</p>","published_at":"2026-05-24T00:00:00Z","modified_at":"2026-05-24T00:00:00Z","url":"https://marcus-outdoor.test/hello/"}]}'

# 3. Read it back via the public llms.txt surface
curl -s -H "X-Quoted-Domain: marcus-outdoor.test" \
  http://localhost:4000/api/public/llm/sitemap.txt
curl -s -H "X-Quoted-Domain: marcus-outdoor.test" \
  http://localhost:4000/api/public/llm/posts/hello.md

# 4. Dashboard
curl -s -H "Authorization: Bearer $JWT" \
  "http://localhost:4000/api/v1/dashboard/summary?days=7"
```

---

## WordPress plugin install (when you have a WP environment)

```bash
# Symlink for live edits:
cd /path/to/your/wp-content/plugins
ln -s /path/to/quoted/wp-plugin quoted

# Or zip for prod install:
cd /path/to/quoted
zip -r quoted.zip wp-plugin/ -x "*.DS_Store"
# Upload via WP Admin → Plugins → Add New → Upload
```

Then in `wp-admin → Plugins → Quoted → Settings`:
1. Backend URL: `http://localhost:4000`
2. License key: paste the contents of `backend/omniplug/keys/<your>.qtd-license.txt`
3. Click **Connect**.

---

## Build order (read this BEFORE you start coding)

1. **Read `docs/PHASE-0-BUILD-PLAN.md` first** — it lays out 4 weeks of
   tasks. Phase 0 is what's in this package. Phases 1–4 are roadmap, not code.

2. **Read `docs/ARCHITECTURE.md`** — understand WP plugin = thin, backend = thick.

3. **Skim `docs/CITATION-TRACKING-SPEC.md`** — you DO NOT build this in Phase 0.
   It's spec only, for Phase 2 (Month 5–6). Knowing it now informs schema design.

4. **Read `docs/DEBUGGING.md`** — common Phase 0 mistakes.

5. **Then** install + run.

---

## What works in v0.1.0 (Phase 0 scope)

- [x] WP plugin installs cleanly on PHP 7.4+, WP 6.0+
- [x] 8-click onboarding wizard (admin/partials/onboarding.php)
- [x] llms.txt auto-generated from published posts/pages
- [x] Markdown endpoint per post (`/wp-json/quoted/v1/llm/{slug}`)
- [x] Bot detection: 10 user-agents (GPTBot, ClaudeBot, PerplexityBot, …)
- [x] Bot crawl logging → synced to backend hourly
- [x] Admin dashboard: AI Distribution Score gauge + bot activity feed
- [x] License key activation against backend
- [x] Free tier limit: 50 posts (configurable in backend)
- [x] Backend SQL migrations 022–025
- [x] Backend modules: wp-sites, bot-crawls, llms-content

## What does NOT work yet (deferred to Phase 1+)

- [ ] Live AI Test (Perplexity proxy) — Phase 1
- [ ] Browser push notifications — Phase 1
- [ ] Paddle payment integration — Phase 1 end
- [ ] Active citation polling — Phase 2
- [ ] Niche benchmark — Phase 3
- [ ] Year in Review — Phase 4
- [ ] Agency tier — Phase 4

Stubs and TODOs are marked clearly in code.

---

## Reuses from OmniPlug v1.4.4

This package is an **extension** of OmniPlug, not a fork:

- Tenants, auth, RBAC, audit, license signing, JWT verification
- `seo-validator.rules.js` → `htmlToText()`, `parseDom()` (used in markdown serializer)
- Rate limiter IP, soft-lock, plan quotas
- SQLite + Litestream, Fly.io deploy
- Migration runner

If you don't have OmniPlug v1.4.4 set up, this package won't run standalone.
See `docs/ARCHITECTURE.md` for the dependency diagram.

---

## Conventions

- All Vietnamese-facing strings: keep Vietnamese with diacritics
- All code comments, variable names, log messages: English
- All user-facing UI strings: English first (i18n-ready via `.pot` file)
- Error messages: structured JSON with `code` field for programmatic handling
- SQL migrations: idempotent, numbered, never edit shipped migrations

---

## License

See LICENSE.txt. Proprietary, all rights reserved by Nguyễn Mạnh Quang.

For questions / debug help: quangnm0208@gmail.com
