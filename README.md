# QuotedEasy AI Readiness

A focused, local-first WordPress plugin that adds the AI readiness layer your
SEO plugin doesn't cover: `llms.txt`, per-post Markdown endpoints, 60+ AI bot
detection, per-bot allow/block list, and JSON-LD that defers cleanly to
Yoast / Rank Math / AIOSEO / SEOPress when they're active.

- **Status:** v0.5.1 — free, no caps, no upgrade prompts, no external services.
- **License:** GPL-2.0-or-later.
- **Built for:** the WordPress community. One developer, no company, no investors,
  no SaaS account behind it.

## Why

AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot, and the rest) read
the web differently from Googlebot. They struggle with ads, popups, JavaScript,
and navigation chrome, and they reach for two signals classical SEO doesn't
emit: a site-level `llms.txt` index and clean per-page Markdown. QuotedEasy AI
Readiness ships both, plus a dashboard that shows you which bots are actually
crawling.

## What's in this repo

```
quotedeasy-ai-readiness/
├── README.md                       ← you are here
├── LICENSE                         ← GPL-2.0-or-later
├── CHANGELOG.md
└── quotedeasy-ai-readiness/        ← the plugin itself (zip this folder to install)
    ├── quotedeasy-ai-readiness.php
    ├── readme.txt                  ← WordPress.org directory format
    ├── includes/
    ├── admin/
    ├── public/
    ├── languages/
    └── uninstall.php
```

## Install

**From a release zip**

1. Download the latest `quotedeasy-ai-readiness-v*.zip` from
   [Releases](https://github.com/muahangngayvn/quotedeasy-ai-readiness/releases).
2. WordPress admin → **Plugins → Add New → Upload Plugin**.
3. Activate. The setup wizard opens automatically.

**From source**

```bash
git clone https://github.com/muahangngayvn/quotedeasy-ai-readiness.git
cd quotedeasy-ai-readiness
zip -r quotedeasy-ai-readiness.zip quotedeasy-ai-readiness/ -x "*.DS_Store"
# Upload via WP Admin → Plugins → Add New → Upload
```

Or symlink for live development:

```bash
ln -s "$(pwd)/quotedeasy-ai-readiness" /path/to/wp-content/plugins/quotedeasy-ai-readiness
```

## What it does

- **`/llms.txt` generator** — proposed by Mistral + Anthropic in September 2024,
  served from your root with a 5-minute cache. Default cap 1,000 most-recent
  posts/pages, filterable via `quotedeasy_ai_readiness_llms_txt_post_limit`.
- **Per-post Markdown** at `quotedeasy-ai-readiness/v1/llm/{slug}` — clean
  body, no ads, no scripts. AI parses Markdown roughly an order of magnitude
  faster than HTML.
- **60+ AI bot signatures** — Anthropic, OpenAI, Google Gemini, Perplexity,
  Mistral, xAI Grok, DeepSeek, Cohere, Apple Intelligence, Meta AI, Amazon,
  ByteDance, Alibaba, Baidu, Naver, Yandex, plus training-corpus crawlers
  (Common Crawl, AI2, LAION, Hive, Diffbot) and the SEO crawlers that resell
  to LLM pipelines (Ahrefs, Semrush, DataForSEO, MJ12).
- **Per-bot allow/block** — blocked bots get HTTP 403 plus a matching
  `Disallow` line in your dynamic `/robots.txt`. The page builds itself only
  for allowed bots.
- **JSON-LD schema** — Article (or BlogPosting) and FAQPage on single posts.
  Auto-defers to Yoast / Rank Math / AIOSEO / SEOPress / Slim SEO / The SEO
  Framework / Squirrly / WP Meta SEO / Schema / Schema Pro when those are
  active so Rich Results doesn't see duplicates. FAQ schema is always emitted
  because most SEO plugins miss shortcode + question-shaped headings.
- **Local dashboard** — AI Distribution Score, top crawling bots, recent
  crawls. Every chart reads from your own database.
- **Privacy by default** — visitor IPs are SHA-256 hashed before storage;
  full kill switch in Settings → Privacy.
- **Under 2 ms overhead** per pageview (one substring scan on the
  User-Agent header).

## Compatibility

- WordPress 6.0+
- PHP 7.4+ (tested through 8.3)
- UTF-8 throughout — verified with Vietnamese, French, Japanese, Chinese
  content.

## External services

**None.** Every feature runs on your own server. The plugin makes zero
outbound HTTP requests under any configuration. No accounts, no API keys, no
telemetry, no remote license checks. See `quotedeasy-ai-readiness/readme.txt` →
*External services* for the full statement.

## Contributing

Issues and pull requests are welcome. This is a solo project maintained in
spare time — please keep patches small and focused. Bug reports with a
reproducible test case get triaged first.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).

If this plugin saves you time, the only ask is: leave the "AI-ready via
QuotedEasy" footer credit on (it's opt-in, off by default) or star the repo.
That's it.

Maintained by Quang Nguyen — &lt;quangnm0208@gmail.com&gt;.
