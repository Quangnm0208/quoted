# Quoted — AI-ready WordPress in 30 seconds

> The lightweight WordPress plugin that makes your content readable, parseable, and citable by ChatGPT, Claude, Perplexity, Google AI, and every other AI search engine.

**WordPress.org plugin** · Free forever tier · Pro from **$9/site/month**

---

## What Quoted does

Your existing SEO plugin (Yoast, Rank Math, AIOSEO) was built for Google's
search bot. AI bots — `ClaudeBot`, `GPTBot`, `PerplexityBot`,
`Google-Extended`, `Applebot-Extended`, and 10+ others — read your site
differently. They bounce off ads, popups, JavaScript, and navigation chrome,
losing ~90% of your content.

**Quoted is the missing AI-readability layer**. It ships everything an
AI-ready WordPress site needs:

- **Auto-generated `/llms.txt`** — the AI-bot equivalent of `sitemap.xml`,
  proposed by Mistral and Anthropic in Sep 2024 and now the de-facto
  standard.
- **Clean Markdown endpoint per post** at `/wp-json/quoted/v1/llm/{slug}` —
  AI parses 10× faster than HTML.
- **AI Crawler Allowlist** — allow or block any of 14+ AI bots with HTTP
  403 + `robots.txt` sync. Block scrapers, keep the ones that cite.
- **Article + FAQPage JSON-LD schema** — conflict-aware: auto-detects
  Yoast / Rank Math / AIOSEO / SEOPress and 11 others, defers Article to
  them, always emits FAQ.
- **Local-first dashboard** — AI Distribution Score, top crawlers, recent
  crawl feed, all reading from your own database. No data leaves your
  server.
- **Lightweight** — under 2 ms overhead per pageview. PHP 7.4 / WP 6.0
  minimum. Works on shared hosting.

---

## Who is it for

| Audience | Why they pick Quoted |
| --- | --- |
| Small business owners | Get cited by AI without learning SEO theory. |
| WordPress agencies | One license covers up to 5 client sites. |
| SEO freelancers | Ship AI-readiness as a productized service. |
| Content marketers | See which posts AI bots actually visit. |
| AI / SEO consultants | Add citation tracking to audit deliverables. |

---

## How it works

```
 1. Install from WordPress.org              (15 sec)
 2. Activate                                ( 5 sec)
 3. Done — niche-aware defaults applied    ( 0 click)
 4. Watch ClaudeBot, GPTBot, PerplexityBot in the dashboard within 24h
```

Setup time: **< 30 seconds**. Industry average: 20+ minutes (Yoast) /
30 min – 4 h (DIY with Claude/Codex). Zero-click defaults: niche
auto-detected, llms.txt live, Markdown endpoints enabled, schema
auto-deferred to your existing SEO plugin.

---

## Pricing

| Plan | Price | Best for | What you get |
| --- | --- | --- | --- |
| **Free** | $0 forever | Starting sites | llms.txt up to 50 posts · Markdown endpoints · 14-bot tracking · Crawler controls · Article + FAQ schema · 7-day local bot history |
| **Solo** | $9/site/mo (yearly) | One site you care about | Everything in Free · **Unlimited posts in llms.txt** · 30-day history · Live AI test (Pro) · Citation testing (Pro) · BYO Perplexity / Tavily key · Remove footer badge · Up to 5 sites |
| **Agency** | $29/site/mo (yearly) | Teams managing many sites | Everything in Solo · Multi-site usage · Client reports · CSV export · 90-day history · Priority support |

Billing is securely handled by **Lemon Squeezy** (merchant of record —
handles VAT/sales tax for your region). 14-day money-back guarantee.

---

## Why Quoted vs the alternatives

| | DIY with Claude/Codex | Yoast Premium | Free competitors | **Quoted Pro** |
| --- | --- | --- | --- | --- |
| Setup time | 30 min – 4 h | 20 min · 12 tabs | 5 min · 5 click | **< 30 s · 0 click** |
| llms.txt auto-gen | ❌ build it yourself | ✅ ($99/yr) | ✅ | ✅ |
| Bot detection (14+) | ❌ | ❌ | ✅ | ✅ |
| **Per-bot HTTP 403 block** | ❌ | ❌ | ❌ | **✅ only Quoted** |
| Schema non-conflicting with 15+ SEO plugins | ❌ tedious | N/A | partial | **✅ only Quoted** |
| Citation tracking | ❌ | ❌ | ❌ | ✅ (Pro, BYO key) |
| GDPR-friendly local-only | tu lo | tu lo | varies | ✅ |
| Maintenance when WP/PHP updates | tu lo (2 h/quarter) | Yoast lo (for SEO bot) | depends | **Quoted lo** |
| 12-month cost | $0 + ~8 h labor ($400+) | $99 | $0 | **$108 (Solo, yearly)** |

---

## Privacy

Free tier is **fully standalone** — no data leaves your WordPress site.
Bot logs live in your local `wp_quoted_bot_log` table. IPs are SHA-256
hashed before storage (toggle off to store raw IPs at your discretion).
On uninstall you can optionally purge all Quoted data.

Pro features that call AI APIs (Perplexity, Tavily) use **your own API
key** — Quoted does not proxy, log, or charge you per query.

---

## Quick links

- **Install:** https://wordpress.org/plugins/quoted/
- **Website:** https://quotedeasy.com
- **Documentation:** https://quotedeasy.com/docs
- **Pricing:** https://quotedeasy.com/pricing
- **Changelog:** https://quotedeasy.com/changelog
- **Source code:** https://github.com/muahangngayvn/quoted
- **Support:** support@quotedeasy.com

---

## License

Plugin is GPL-2.0-or-later. Brand identity (logos, color system) © Quoted
Brand v1.0. Trademark "Quoted" © Nguyễn Mạnh Quang.

---

*Last updated: 2026-05-24 · Plugin v0.4.0*
