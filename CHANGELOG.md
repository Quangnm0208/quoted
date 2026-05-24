# Changelog

All notable changes to Quoted will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] — 2026-05-24

### Brand identity refresh — admin UI

**Maintainer:** Nguyễn Mạnh Quang &lt;quangnm0208@gmail.com&gt;

Applies the official Quoted brand v1.0 (indigo `#3b3fbf` primary, Inter
typography fallback, refined spacing and radii) to every admin page.

#### Added

- `admin/images/logo-mark.svg` — primary brand mark (Q-quote)
- `admin/images/favicon.svg` — favicon variant
- `.quoted-header-brand` wrapper renders logo + title + subtitle in
  dashboard / onboarding / settings / upgrade pages

#### Changed

- `admin/css/quoted-admin.css` — full repaint to brand tokens:
  - Primary `#2271b1` → indigo `#3b3fbf` with hover `#2f33a3`
  - Radii: 4px → 6px (buttons) / 8px (cards)
  - Typography: 16/28px → 14/22px with `-0.018em` heading tracking
  - Pill-shaped `.quoted-plan-badge` with status dot
  - Brand-soft callouts for tips / next-action / scan results
- `admin/css/billing.css` — same palette swap via CSS vars + fallbacks
- Settings form table polish: smaller font, 6px input radii
- `.button-primary` inside Quoted pages adopts brand indigo (scoped, does
  not affect WP core or other plugins)
- Onboarding progress bar — flex with gap, active step in brand, done
  step in success-bg

#### Notes

No functional changes from 0.2.0 — same 14-bot allowlist, /llms.txt
pipeline, schema engine, Lemon Squeezy direct license flow. This release
is visual-only and safe to update from any 0.2.x version.

The broader admin UX restructure (sidebar layout, dashboard cards per
the new mockups, sectioned settings) is scheduled for Sprint 3 in
`docs/FEATURE-PLAN-2026-Q2-Q3.md`.

## [0.2.0] — 2026-05-23

### Public WordPress.org release

See `wp-plugin/readme.txt` for the canonical wp.org changelog.
Highlights: standalone refactor (drop OmniPlug backend), AI Crawler
Allowlist with HTTP 403, Schema engine with 15+ SEO-plugin coexistence,
direct Lemon Squeezy License API integration, P1 security hardening.

## [0.1.0] — 2026-05-23

### Initial Phase 0 Scaffold

**Maintainer:** Nguyễn Mạnh Quang &lt;quangnm0208@gmail.com&gt;

Production-bound scaffold. Not yet deployed.

#### Added — WordPress plugin

- Main entry point with WP plugin headers, PSR-style autoloader
- 8-click onboarding wizard (license → niche → scan → test → done)
- Admin dashboard with AI Distribution Score gauge
- Bot detection middleware covering 14 AI bots:
  - ClaudeBot, GPTBot, ChatGPT-User, OAI-SearchBot
  - PerplexityBot, Perplexity-User
  - GoogleExtended, Applebot-Extended
  - Bytespider, FacebookBot/Meta, CCBot, DiffBot
  - Cohere, YouBot
- Local bot crawl logging with SHA-256 IP hashing
- Hourly cron sync to backend (`quoted_cron_sync_crawls`)
- Twice-daily post sync (`quoted_cron_sync_posts`)
- Hourly JWT refresh (`quoted_cron_refresh_token`)
- REST endpoints:
  - `GET /wp-json/quoted/v1/llms.txt`
  - `GET /wp-json/quoted/v1/llm/{slug}`
- Rewrite rule: `/llms.txt` at site root
- "Powered by Quoted" footer badge (free tier)
- Full uninstall cleanup
- WordPress.org-compatible `readme.txt`
- i18n template (`languages/quoted.pot`)
- Settings: backend URL, IP hashing toggle, badge toggle, disable logging
- HTML→Markdown serializer using DOMDocument

#### Added — Backend (OmniPlug v1.5.0 extensions)

- SQL migrations 022 (wp_sites), 023 (bot_crawls), 024 (citations), 025 (notif_prefs)
- `wp-sites` module: registration, JWT issuance, post sync, dashboard summary
- `bot-crawls` module: batch ingestion with minute-precision dedup
- `llms-content` module: public llms.txt + markdown endpoints
- `citations` module: schema + stub endpoints (full impl in Phase 2)
- `live-ai-test` module: stub returning 501 (full impl in Phase 1)
- jsdom-based markdown serializer reusing OmniPlug seo-validator patterns
- Domain-bound license verification with anti-resale check
- Free tier quota enforcement: 50 posts limit
- AI Distribution Score formula (diversity 40 / volume 30 / coverage 30)

#### Added — Documentation

- Architecture overview
- API contract (8 endpoints documented)
- Phase 0 build plan (4-week, task-by-task)
- Citation tracking algorithm spec (for Phase 2)
- Deployment guide (Fly.io + WP install)
- Debugging guide (12 common failure modes)

#### Known limitations (intentional)

- Live AI Test returns "coming soon" placeholder in onboarding step 4
- Citation tracking dashboard tab shows paywall teaser for free tier
- Push notifications not implemented (Phase 1)
- Paddle payment integration not implemented (Phase 1)
- Niche benchmark not implemented (Phase 3)
- Agency tier not implemented (Phase 4)
- Chart.js must be manually downloaded (see admin/js/chart.umd.min.js note)

#### Conventions established

- Vietnamese-facing strings: keep Vietnamese with diacritics
- Code comments, variable names, log messages: English
- User-facing UI strings: English first (i18n-ready)
- Error envelope: `{ error: { code, message, details } }`
- License key prefix: `qtd_live_` / `qtd_test_`
- License signing: full Vietnamese name "Nguyễn Mạnh Quang" with diacritics
- SQL migrations: idempotent, numbered, never edit shipped ones
- WP coding standards (phpcs WordPress standard)
- Backend follows OmniPlug v1.4.4 module pattern (controller/service/repository)
