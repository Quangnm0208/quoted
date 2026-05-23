# Quoted MVP v0.1.0 — AI Citation Plugin for WordPress

**Owner:** Nguyễn Mạnh Quang &lt;quangnm0208@gmail.com&gt;
**Status:** Phase 0 scaffold — production-bound, not yet deployed
**Date packaged:** 2026-05-23

This package contains the complete buildable scaffold for the Quoted product:
a WordPress plugin (PHP) + backend extensions to the existing OmniPlug CMS Core
(Node.js) that together let WP site operators make their content AI-readable,
track AI bot activity, and surface citations from Perplexity / ChatGPT / Claude.

---

## What's in this package

```
quoted-mvp-v0.1.0/
├── README.md                  ← you are here
├── LICENSE.txt
├── NOTICE.txt
├── CHANGELOG.md
│
├── docs/                      ← Strategy + architecture docs
│   ├── PHASE-0-BUILD-PLAN.md  ← 4-week task-by-task build plan
│   ├── CITATION-TRACKING-SPEC.md  ← Algorithm spec for Phase 2 (build later)
│   ├── ARCHITECTURE.md        ← System overview
│   ├── API-CONTRACT.md        ← WP plugin ↔ backend contract
│   ├── DEPLOYMENT.md          ← Fly.io + WP plugin deploy steps
│   └── DEBUGGING.md           ← Common failure modes + fixes
│
├── wp-plugin/                 ← WordPress plugin (PHP, ready to zip & install)
│   ├── quoted.php             ← Main entry
│   ├── readme.txt             ← wp.org directory format
│   ├── includes/              ← Core classes
│   ├── admin/                 ← Admin dashboard + onboarding
│   ├── public/                ← REST API + bot detector
│   └── languages/
│
├── backend/                   ← OmniPlug extensions
│   ├── migrations/            ← SQL migrations 022–025
│   ├── modules/               ← New modules (wp-sites, bot-crawls, etc.)
│   └── scripts/               ← Operator CLIs
│
└── tests/
    ├── wp-plugin-tests.md     ← Manual test plan for plugin
    └── backend-tests.md       ← Backend test plan
```

---

## Quick start (debug locally)

### 1. Backend setup (extends OmniPlug v1.4.4)

```bash
# In your existing omniplug-cms-core-v1.4.4 directory:
cp -r /path/to/quoted-mvp-v0.1.0/backend/migrations/*.sql src/core/db/migrations/
cp -r /path/to/quoted-mvp-v0.1.0/backend/modules/* src/backend/modules/

# Wire routes in src/backend/server.js — see backend/README.md

# Run migrations
node src/core/db/migrate.js

# Boot backend
JWT_SECRET="$(openssl rand -hex 32)" \
ADMIN_EMAIL=admin@local \
ADMIN_INITIAL_PASSWORD=ChangeMe123! \
LICENSE_ENFORCEMENT=warn \
PERPLEXITY_API_KEY=pplx-xxx \
TELEMETRY_URL=disabled \
npm run dev
```

### 2. WordPress plugin install (local dev)

```bash
# Symlink for live edits:
cd /path/to/your/wp-content/plugins
ln -s /path/to/quoted-mvp-v0.1.0/wp-plugin quoted

# Or zip for prod install:
cd /path/to/quoted-mvp-v0.1.0
zip -r quoted.zip wp-plugin/ -x "*.DS_Store"
# Upload via WP Admin → Plugins → Add New → Upload
```

### 3. Connect plugin to backend

```php
// In wp-admin → Plugins → Quoted → Settings
// 1. Backend URL: http://localhost:4000  (or your Fly.io URL)
// 2. License key: paste from backend issue script
// 3. Click "Connect"
```

### 4. Smoke test

```bash
# llms.txt should serve:
curl http://your-site.local/llms.txt

# Markdown endpoint for any post:
curl http://your-site.local/wp-json/quoted/v1/llm/hello-world

# Bot detection (simulate ClaudeBot):
curl -A "ClaudeBot/1.0" http://your-site.local/sample-post/
```

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
