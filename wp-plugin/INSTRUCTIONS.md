# QuotedEasy AI Readiness — User Guide

**Version 0.5.1** | Requires WordPress 6.0+ and PHP 7.4+

---

## What This Plugin Does

QuotedEasy AI Readiness makes your WordPress site readable by AI assistants (ChatGPT, Claude, Perplexity, Gemini, and 60+ others). It works alongside your existing SEO plugin and adds what those plugins don't cover: the signals and content formats that AI systems need to find, parse, and quote your site.

**Core features:**
- Generates `/llms.txt` — the AI-equivalent of a sitemap
- Serves every post and page as clean Markdown via a REST endpoint
- Detects and logs 60+ AI bot signatures in real time
- Lets you allow or block each bot individually
- Adds Article and FAQPage JSON-LD schema (defers to Yoast / Rank Math / AIOSEO automatically)
- Local-first: nothing leaves your server, no account required

---

## Installation

1. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**.
2. Upload `quotedeasy-ai-readiness.zip` and click **Install Now**.
3. Click **Activate Plugin**.
4. The setup wizard opens automatically — follow the 3 steps (about 60 seconds).

> **Manual install:** Unzip and upload the `quotedeasy-ai-readiness` folder to `/wp-content/plugins/`, then activate from the Plugins screen.

---

## First-Time Setup

After activation, the wizard will guide you through:

1. **Generate llms.txt** — scans your published posts and pages and builds the AI sitemap.
2. **Review your AI crawler allowlist** — decide which bots are allowed or blocked.
3. **Done** — the dashboard is ready.

Visit `https://your-site.com/llms.txt` to confirm it resolves correctly.

> If you use **Plain permalinks**, switch to any other option under **Settings → Permalinks**. Plain permalinks prevent `/llms.txt` from resolving as a clean URL.

---

## Dashboard

**Quoted → Dashboard** shows:

| Card | What it shows |
|---|---|
| AI Distribution Score | Which AI systems are actively crawling your site |
| Recent Crawls | Live feed of the latest bot visits |
| Next Action | Guided prompt if something needs attention |

---

## Settings

Go to **Quoted → Settings** to configure:

### AI Crawler Allowlist
Every supported bot has an **Allow / Block** toggle. Blocked bots receive HTTP 403 and a matching `Disallow` rule is added to your `robots.txt` automatically.

### Schema
- **Auto (recommended):** Emits Article JSON-LD only when no active SEO plugin is detected. FAQ schema is always emitted from `[faq_item]` shortcodes and question-shaped headings.
- **Always:** Force-emits Article schema regardless of other SEO plugins.
- **Never:** Disables Article schema entirely.

### Privacy
| Option | Default | Effect |
|---|---|---|
| Hash visitor IPs | On | Stores SHA-256 hash instead of raw IP |
| Disable logging | Off | Stops all bot visit recording |
| Trust reverse proxy | Off | Reads IP from `CF-Connecting-IP` / `X-Forwarded-For` (enable only if behind Cloudflare or a trusted proxy) |

### Display
- **Credit in footer** — Off by default. Enable to show a small "AI-readable via QuotedEasy" link in your site footer.

---

## Per-Post Markdown Endpoint

Every published post and page is available as clean Markdown at:

```
/wp-json/quoted/v1/llm/{post-slug}
```

Example: `https://your-site.com/wp-json/quoted/v1/llm/hello-world`

AI systems can fetch this URL directly instead of scraping HTML.

---

## FAQ Shortcode

Add structured FAQ content to any post or page:

```
[faq_item question="What is llms.txt?"]
A plain-text file that tells AI systems what your site is about.
[/faq_item]
```

The plugin extracts these into FAQPage JSON-LD schema automatically.

---

## Filters (for developers)

```php
// Change the llms.txt post limit (default: 1000, -1 = unlimited)
add_filter( 'quoted_llms_txt_post_limit', function () { return 500; } );
```

---

## Uninstalling

- **Deactivate only:** Your data (bot log, settings) is preserved.
- **Delete the plugin:** Removes the bot log table, all plugin options, and all transients cleanly via `uninstall.php`.

---

## Support & Source

- GitHub: https://github.com/Quangnm0208/quoted
- WordPress.org: https://wordpress.org/plugins/quotedeasy-ai-readiness/

---

*QuotedEasy AI Readiness is free and open source under the GPL-2.0 license.*
