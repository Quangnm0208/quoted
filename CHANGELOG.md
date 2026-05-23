# Changelog

All notable changes to Quoted will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
