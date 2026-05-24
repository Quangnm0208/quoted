---
title: "Plugin Setup"
description: "What Quoted configures automatically, and what you can customize."
order: 3
---

Quoted is designed for zero-click setup. On activation it:

- Creates the `wp_quoted_bot_log` table
- Enables all 14 bot signatures with "Allow" (default)
- Turns on Article + FAQPage schema in **Auto** mode (defers to your SEO plugin)
- Enables SHA-256 IP hashing (GDPR-friendly)
- Schedules a daily cron for license revalidation

No configuration is required for the Free tier to work.

## Settings panel

Find it under **WordPress Admin → Quoted → Settings**.

### AI Crawler Allowlist

Allow or block any of the 14 supported bots individually. Blocked bots
receive HTTP 403 and a `Disallow: /` rule appended to your `robots.txt`
under that bot&apos;s `User-agent`.

Common choices:

- **Allow all** (default) — maximize AI citation visibility.
- **Block Bytespider** — ByteDance/TikTok scrapes for training without
  clear opt-out.
- **Block CCBot** — Common Crawl, often used to seed LLM training sets.
- **Allow PerplexityBot + ClaudeBot** — these tend to actually cite sources.

### Schema engine

- **Auto** (default): detects active SEO plugins and skips Article schema
  if Yoast / Rank Math / AIOSEO / SEOPress is active. FAQ schema always
  emits.
- **Always**: emit both regardless of other plugins.
- **Never**: suppress Article schema only.

### Privacy

- **Hash IPs before logging** (default ON) — SHA-256 with a per-site salt.
- **Disable bot crawl logging entirely** — kill switch for max privacy.
- **Trust proxy** — honor `X-Forwarded-For` if you&apos;re behind a CDN.

### Footer badge

The "Powered by Quoted" footer badge is required for Free-tier users and
optional for Pro users.
