# Quoted — System Architecture

## Two-component system

```
┌──────────────────────────────────────────────────────────────┐
│                    WordPress site (customer)                 │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  Quoted Plugin (PHP, ~800 LOC)                     │    │
│   │  • Bot detection middleware                        │    │
│   │  • REST: /llms.txt, /llm/{slug}                    │    │
│   │  • Cron: hourly sync to backend                    │    │
│   │  • Admin: onboarding wizard + dashboard            │    │
│   │  • License key + JWT storage                       │    │
│   └─────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                  HTTPS + JWT (RS256)
                          │
┌─────────────────────────▼────────────────────────────────────┐
│              Quoted Backend (OmniPlug v1.5.0)                │
│                  Fly.io shared-cpu-2x, 1GB                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ REUSED from OmniPlug v1.4.4 (no changes)             │   │
│  │ • tenants, users, auth, RBAC, audit                  │   │
│  │ • license signing (RS256/ES384), JWT verify, CRL     │   │
│  │ • seo-validator: htmlToText, parseDom (jsdom)        │   │
│  │ • articles, projects, leads repositories             │   │
│  │ • rate limiter IP, plan quotas                       │   │
│  │ • SQLite + Litestream, migration runner              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ NEW for Quoted (this package)                        │   │
│  │ • wp-sites module (register WP installs)             │   │
│  │ • bot-crawls module (ingest hourly batches)          │   │
│  │ • llms-content module (serve llms.txt + markdown)    │   │
│  │ • citations module (Phase 2 stub)                    │   │
│  │ • live-ai-test module (Phase 1 stub)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ External APIs (Phase 1+)                             │   │
│  │ • Perplexity Sonar (citation polling)                │   │
│  │ • Tavily (fallback)                                  │   │
│  │ • Resend (transactional email)                       │   │
│  │ • OneSignal (push notifications)                     │   │
│  │ • Paddle (payment + tax)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Why this split

### WP plugin is THIN

The PHP plugin does only 4 things:
1. **Route llms.txt** to backend (or serve cached version)
2. **Detect bots** by user-agent on page hits
3. **Sync data** to backend (hourly cron, batch)
4. **Render admin UI** (iframe-style, calls backend for data)

Reasons:
- WordPress.org plugin updates take 1–7 days to propagate. Backend updates
  are instant. Keeping intelligence on backend = ship fixes anytime.
- PHP plugin codebase clones are trivial. Backend code stays private.
- AI provider integrations (Perplexity, etc.) require API keys we never
  want in client code.
- Multi-site agency tier: 1 backend tenant + N plugin installs is the
  natural shape only if backend holds the source of truth.

### Backend is THICK

All citation logic, scoring, polling, notifications, billing live in backend.

This means: the WP plugin can ship to wordpress.org as free + open-source
(builds trust), while the moat (citation algorithm + niche data) stays
proprietary on backend.

---

## Data flow: 5 critical paths

### Path 1: Plugin activation → backend tenant creation

```
User pastes license key in plugin onboarding step 1
  → Plugin POSTs /api/v1/wp-sites/register with { license_key, domain, wp_version }
  → Backend verifies license signature (RS256 from operator key)
  → Backend checks domain matches license claim (anti-resale)
  → Backend creates tenant if new, or fetches existing
  → Backend mints JWT (24h expiry, refresh via license re-verification)
  → Plugin stores JWT in wp_options (encrypted)
```

Failure modes: see `docs/DEBUGGING.md`.

### Path 2: AI bot hits a page

```
ClaudeBot fetches /best-running-shoes/
  → WP loads page normally (we don't block or alter content for bots)
  → Quoted middleware (hooked on `init`, priority 1) reads User-Agent
  → If matches known bot list: write row to wp_quoted_bot_log table
  → Page completes serving (no latency added for the bot)
```

Why log locally first, sync to backend later:
- Latency: cannot make bot wait for backend roundtrip
- Reliability: if backend is down, no events lost
- Cost: batch of 100 events = 1 HTTP call instead of 100

### Path 3: Hourly sync (WP cron)

```
WP-Cron fires (every hour)
  → Plugin reads up to 500 unsent rows from wp_quoted_bot_log
  → POSTs batch to /api/v1/bot-crawls/batch with JWT
  → Backend validates, dedupes (same bot + url + minute = 1 event),
    inserts into bot_crawls table with tenant_id from JWT
  → Plugin marks rows as sent (or deletes them)
  → If backend returns 401 (expired JWT), plugin re-activates license
```

### Path 4: AI bot fetches llms.txt

```
ClaudeBot fetches https://marcus-outdoor.com/llms.txt
  → WP rewrite rule routes to /wp-json/quoted/v1/llms.txt
  → Plugin checks local 5-min transient cache
  → Cache miss: GET backend /api/public/llm/sitemap.txt
    with Host header = marcus-outdoor.com
  → Backend resolves tenant by host, generates llms.txt from articles table,
    caches 24h
  → Plugin serves response with Content-Type: text/markdown
```

### Path 5: Admin dashboard load

```
Marcus visits wp-admin → Quoted menu
  → admin.php renders dashboard.php partial
  → JS calls backend /api/v1/dashboard/summary with JWT
  → Backend aggregates: bot_crawls last 7d, top bots, top URLs,
    AI Distribution Score (computed from sync coverage, bot diversity, content
    freshness)
  → JS renders gauge + feed + next-action card
```

---

## Tenancy model

Inherited from OmniPlug v1.4.4 (shared-schema, tenant_id-scoped).

Each WP site = 1 tenant. Domain → tenant resolution via license key (not
Host header — prevents domain spoofing).

Critical: WP plugin sends `Authorization: Bearer <jwt>` on every API call.
JWT payload includes `tenant_id`. Backend uses this, NOT the Host header,
to scope all queries.

Exception: public llms.txt and markdown endpoints DO use Host header for
tenant resolution (because AI bots don't have JWTs). This is safe because
those endpoints only return publicly visible content.

---

## Tech stack final

| Layer | Choice |
|---|---|
| Backend | Node.js 20 + Express (existing OmniPlug) |
| Database | SQLite + Litestream backup (existing OmniPlug) |
| Cache/queue | Redis (Fly.io Upstash, new for Quoted) |
| WP plugin | PHP 7.4+, WP 6.0+ (constraint: shared hosting reality) |
| Dashboard | Vanilla JS + Chart.js bundled (no React in WP admin to keep size <100KB) |
| Payment | Paddle (Phase 1) |
| Email | Resend (Phase 1) |
| Push | OneSignal (Phase 1) |
| AI APIs | Perplexity Sonar + Tavily (Phase 2) |
| Hosting | Fly.io sin region (existing OmniPlug) |
| CDN | Cloudflare free tier for llms.txt edge cache |

---

## Performance budgets

| Metric | Budget | Why |
|---|---|---|
| Plugin TTFB overhead on frontend page | ≤50ms | Marcus's site speed is sacred |
| llms.txt response | ≤200ms cached, ≤1s cold | AI bots time-out aggressively |
| Markdown endpoint | ≤300ms cached, ≤2s cold | Same |
| Admin dashboard load | ≤1s | Bounce risk |
| Backend bot crawl ingestion | ≤500ms for 500-event batch | Hourly cron must finish before next run |
| Backend single tenant DB queries | ≤50ms p99 | OmniPlug already verified at scale |

---

## Security model

| Vector | Mitigation |
|---|---|
| License key theft | Domain-bound license; rebind costs operator review |
| JWT theft from wp_options | Encrypted at rest with WP salts; rotate every 24h |
| WP plugin RCE | phpcs WordPress standard, no `eval`/`extract`/untrusted unserialize |
| Backend SQL injection | All queries parameterized via better-sqlite3 prepared statements |
| Backend SSRF (markdown endpoint fetches arbitrary URL) | We don't fetch arbitrary URLs; we serve our own DB |
| AI bot impersonation (someone sends ClaudeBot UA to skew metrics) | Rate limit per IP; doesn't affect billing (we don't charge per crawl) |
| Customer data exfil to AI providers | TOS guarantee + DPA; cite polling sends prompts only, never customer content |
| Bot crawl logs reveal user IPs | We hash IPs SHA-256 before sending to backend (default ON) |

---

## Scalability notes

OmniPlug v1.4.4 verified at 90 tenants × 270 users × 450 articles × 150K
leads with RAM ≤132MB on shared-cpu-1x.

Quoted scale targets:
- Month 4: ~30 paid tenants → ~30 active. No scale concerns.
- Month 12: 300 paid + 50 agency × 15 sites = 1,050 tenants. Within OmniPlug
  verified envelope (90 tenants tested).
- Year 2: 1,000+ paid → may need shared-cpu-4x ($30/mo) and read replica.

Bot crawl ingestion is the new pressure point:
- Avg site: 50 bot crawls/day = 1,500/month
- 1,000 tenants × 1,500/month = 1.5M crawl rows/month = 18M/year
- At ~100 bytes/row = 1.8GB/year of crawl data
- SQLite with proper indexing handles this. Plan a partitioning migration
  at year 2.

---

## What's NOT in this architecture (intentional)

- **No React in WP plugin admin.** Vanilla JS, ~30KB total. WP admin pages
  load fast, dependency-free.
- **No GraphQL.** REST only. Simpler debugging, better caching.
- **No Kubernetes.** Fly.io machines + Litestream. Solo operator can manage.
- **No vector DB.** Phase 4+ if we add semantic citation matching.
- **No multi-region.** Single region (sin) for now. Plan: add iad in Year 2
  when US users complain about latency.
- **No microservices.** OmniPlug stays modular monolith. One process, one DB.
