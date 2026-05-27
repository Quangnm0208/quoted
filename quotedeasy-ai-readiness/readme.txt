=== QuotedEasy AI Readiness ===
Contributors: muahangngayvn
Tags: ai, llms-txt, schema, ai-crawlers, seo
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.5.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI readiness layer for WordPress sites: llms.txt, clean Markdown content signals, AI crawler detection, allow/block controls, and schema support.

== Description ==

**QuotedEasy AI Readiness is a focused, local-first AI readiness layer for WordPress.** It runs alongside your existing SEO plugin (Yoast, Rank Math, AIOSEO, SEOPress) and adds the layer those plugins do not cover: signals and content shapes that AI assistants and search engines need to find, parse, and quote your site.

= What QuotedEasy AI Readiness does =

* **llms.txt generator at `/llms.txt`** — the AI-equivalent of `sitemap.xml`, proposed by Mistral + Anthropic and adopted by AI search systems through 2025–2026.
* **Per-post Markdown endpoints** — every published post and page is served as clean Markdown at the REST endpoint `quotedeasy-ai-readiness/v1/llm/{slug}`. AI parses Markdown roughly an order of magnitude faster than scraping ad-laden HTML.
* **60+ AI bot signatures** detected automatically — every major LLM operator (Anthropic, OpenAI, Google Gemini, Perplexity, Mistral, xAI Grok, DeepSeek, Cohere, Apple Intelligence, Meta AI, Amazon, Bytedance, Alibaba, Baidu, Naver, Yandex), the training-corpus crawlers (Common Crawl, AI2, LAION, Hive, Diffbot), and the SEO crawlers that resell data to LLM training pipelines (Ahrefs, Semrush, DataForSEO, MJ12).
* **AI Crawler Allowlist** — allow or block any of those bots one by one. Blocked bots get HTTP 403 plus a matching `Disallow` rule in your robots.txt. The page builds itself only for allowed bots.
* **Schema engine** — Article (or BlogPosting) and FAQPage JSON-LD on single posts. Auto-detects active SEO plugins (Yoast, Rank Math, AIOSEO, SEOPress, Slim SEO, The SEO Framework, Squirrly, WP Meta SEO, Schema, Schema Pro) and defers Article schema to them so Google Rich Results doesn't see duplicates. FAQ schema is still emitted from `[faq_item]` shortcodes and H2/H3 question patterns.
* **Local dashboard** — AI Distribution Score, top crawling bots, recent crawls, next-action prompts. Every chart reads from your own database.
* **Privacy by default** — visitor IPs are SHA-256 hashed before storage; can be disabled entirely with a kill switch.
* **< 2 ms overhead** per pageview — one substring scan on the User-Agent header.
* **Multi-language** — UTF-8 throughout; tested with French accents, Vietnamese diacritics, Japanese kanji, CJK characters.

= How QuotedEasy AI Readiness is different =

The WordPress.org directory has many plugins that generate `llms.txt`. QuotedEasy AI Readiness is the only one (at the time of writing) that bundles **all** of the following in one place:

1. **AI Crawler Analytics** — real-time detection + logging of 60+ AI bots, with a per-bot allowlist and a live dashboard. Most llms.txt generators do not include bot tracking at all.
2. **Per-post Markdown REST endpoints** — a permanent, AI-fetchable URL for every published post. Most plugins only output a single `/llms.txt` and leave the per-post fetch as a TODO.
3. **Schema.org JSON-LD auto-deferral** — if Yoast/Rank Math/AIOSEO/SEOPress is active, Article schema is suppressed automatically. FAQ schema is still emitted from shortcodes and question-shaped headings, because most SEO plugins do not pick those up.
4. **Robots.txt sync** — blocked bots get a matching Disallow rule appended to your dynamic `/robots.txt`, so well-behaved bots stop crawling on their own.
5. **Local-first by design** — no account, no external service, no analytics, nothing leaves your server.

= AI engines tracked =

ChatGPT (GPTBot, ChatGPT-User, OAI-SearchBot, Operator), Claude (ClaudeBot, Claude-User, Claude-SearchBot), Perplexity (PerplexityBot, Perplexity-User), Google AI Overviews & Gemini (Google-Extended, GoogleOther), Apple Intelligence (Applebot-Extended), Meta AI, Mistral, xAI Grok, DeepSeek, Cohere, Amazon, ByteDance/Doubao, Alibaba/Tongyi, Baidu ERNIE, Naver CLOVA X, Yandex, Sogou, Huawei PetalBot, You.com, Phind, Kagi, Andi, Komo, AI2Bot, Common Crawl, LAION FriendlyCrawler, Hive ImagesiftBot, Diffbot, Semantic Scholar, TimpiBot, PleiasBot, omgilibot, img2dataset, Internet Archive — plus the SEO crawlers that resell data to LLM training pipelines (Ahrefs, Semrush, DataForSEO, MJ12). The full list is visible in **Settings → AI crawler allowlist**.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/quotedeasy-ai-readiness/`, or install via **Plugins → Add New → Upload**.
2. Activate through the **Plugins** menu.
3. The plugin auto-redirects you to a short setup wizard (about 60 seconds). Follow the three steps and finish into the dashboard.
4. Visit **QuotedEasy → Settings** to review the AI crawler allowlist, privacy options, schema mode, and optional footer credit.
5. Confirm `/llms.txt` resolves by opening `https://your-site.com/llms.txt` in a browser. You should see your AI-readable sitemap.

If you use "Plain" permalinks, switch to any other permalink option so `/llms.txt` resolves cleanly. The REST endpoint at `/?rest_route=/quotedeasy-ai-readiness/v1/llms.txt` always works as a fallback.

== Frequently Asked Questions ==

= Does QuotedEasy AI Readiness send data to external services? =

No. Everything runs on your own server: llms.txt generation, Markdown serialization, bot detection, schema output, the admin dashboard — all of it. The plugin does not contact any third party. See the "External services" section below.

= Does this conflict with my existing SEO plugin (Yoast, Rank Math, AIOSEO, SEOPress)? =

No. SEO plugins optimize for the Google search bot. QuotedEasy AI Readiness optimizes for AI bots — they read your site in different ways. QuotedEasy AI Readiness does not touch your meta tags, sitemap.xml, or any SEO settings. Your Google ranking is unchanged.

The Schema engine is smart about it. In **Auto mode** (the default), QuotedEasy AI Readiness detects active SEO plugins and skips Article schema to avoid duplicate JSON-LD warnings. FAQ schema is still emitted because most SEO plugins do not pick up shortcode-based FAQ patterns.

= AI bots already crawl my site. Why do I need a plugin? =

AI bots can crawl HTML, but they bounce off ads, popups, JavaScript, and navigation chrome, losing a substantial portion of your content. The `llms.txt` spec (proposed by Mistral and Anthropic in September 2024) and clean per-post Markdown are the AI-native answer. Sites that ship them early appear in more AI answers.

= Will this slow down my site? =

No. Bot detection is a single substring scan on the User-Agent header — well under 2 ms per pageview. The `/llms.txt` file is cached for 5 minutes and served with edge-cache headers.

= How does the AI Crawler Allowlist work? =

In **Settings → AI crawler allowlist**, every supported bot has Allow / Block radio buttons. Blocked bots receive HTTP 403 when they request a page and a matching `Disallow: /` rule is appended to your robots.txt under that bot's User-agent. Bots that respect robots.txt will stop crawling on their own; the 403 covers the ones that don't.

= How do I enable the "AI-ready via QuotedEasy" footer credit? =

It is off by default. Go to **Settings → Display → Credit in footer** and tick the box. Uncheck to remove it again.

= How big does the llms.txt file get on a large site? =

By default the file lists the 1,000 most-recently-modified published posts and pages. If your site needs more, increase the cap with the `quotedeasy_ai_readiness_llms_txt_post_limit` filter (pass `-1` for unlimited):

`add_filter( 'quotedeasy_ai_readiness_llms_txt_post_limit', function () { return -1; } );`

= Will my data be lost if I deactivate or delete the plugin? =

Deactivating leaves your data in place. Deleting removes the bot log table, all plugin options, and all transients in one pass — exactly what you would expect.

= I have multibyte content (Vietnamese, Japanese, Chinese). Will it work? =

Yes. QuotedEasy AI Readiness is UTF-8 throughout. Post titles, body content, and category names survive intact in the Markdown output. WordPress's built-in slug generator strips CJK characters from URLs — that is a core WordPress behavior, not a plugin limitation. For Japanese/Chinese sites, install a transliteration plugin if you want readable slugs.

= What if my host blocks AI bot user-agents? =

Some shared hosts have WAF rules that block bot user-agents. If you see zero crawls after a week, contact your host and ask them to whitelist ClaudeBot, GPTBot, and PerplexityBot. The dashboard's "Next action" card prompts you to check this if no bots arrive after seven days.

== External services ==

**This plugin does not contact any external service.** Every feature is local-first:

* `/llms.txt` is generated from your own posts and pages.
* Per-post Markdown is rendered from your own post content.
* Bot crawls are logged to your own database table (`{prefix}_quotedeasy_ai_readiness_bot_log`).
* Schema JSON-LD is emitted into your own pages.
* The admin dashboard reads only from your own database.

No outbound HTTP requests are made by the plugin under any configuration. There are no accounts, API keys, license keys, or telemetry endpoints involved in the plugin shipped through this directory.

== Screenshots ==

1. AI Distribution Score gauge + recent bot crawls feed on the local dashboard.
2. AI Crawler Allowlist — Allow / Block toggle per bot with the operator (Anthropic, OpenAI, Perplexity, etc.) shown beneath each bot name.
3. Schema settings — master enable + Auto / Always / Never mode. The Auto label names the active SEO plugin so you know why Article is being deferred.
4. `/llms.txt` rendered output in the browser, with site description and the most-recent published posts.
5. Per-post Markdown endpoint — clean Markdown body, no ads, no scripts.
6. Settings → Privacy — IP hashing toggle, disable-logging kill switch, trust-proxy opt-in.
7. Welcome wizard on first activation — ready in three steps.

== Changelog ==

= 0.5.2 =
* Removed `Network: false` and `Update URI: false` plugin headers (not permitted on WordPress.org-hosted plugins).
* Updated "Tested up to" to the current WordPress version.

= 0.5.1 =
* Renamed from Quoted to QuotedEasy AI Readiness for WP.org directory naming compliance.
* Plugin slug changed to `quotedeasy-ai-readiness`. Text domain updated to match.
* All internal class names, constants, option names, REST namespace, AJAX actions, CSS/JS handles, and the bot log database table have been renamed to the new prefix.
* No behavior changes. Functionality equivalent to 0.5.0.

= 0.5.0 =
* **Free-only WordPress.org build.** The plugin is now fully functional with no caps, no license check, no upgrade prompts. Every feature listed above is available to every install.
* **No external services.** All previously planned commercial integrations have been removed from this directory release. Nothing leaves your server.
* **Credit in footer is opt-in.** The "AI-ready via QuotedEasy" footer link is off by default; enable it under **Settings → Display**.
* **Security hardening.** `$_SERVER` inputs (User-Agent, REQUEST_URI, forwarded IPs) are sanitized at the boundary. JSON-LD output is hex-escaped against `<`, `>`, `&`, `'`, `"` so user content cannot break out of the inline `<script>` tag.
* **llms.txt default cap raised to 1,000.** Filterable via `quotedeasy_ai_readiness_llms_txt_post_limit` (pass `-1` for unlimited).
* **REST URL resolution.** Per-post Markdown URLs now use `rest_url()` instead of a hard-coded `/wp-json/` path, so they survive `rest_url_prefix` filters.
* **Cleaner uninstall.** Deleting the plugin removes the bot log table, all plugin options, and all transients in one pass.
* **Plugin requires WordPress 6.0 and PHP 7.4.**

= 0.4.1 =
* Onboarding fix: completing the wizard now reaches the dashboard.
* JSON-LD escaping hardened.
* Bot log pruning at the 10 000-row cap.
* Various small fixes around plugin packaging.

= 0.3.0 =
* Bot catalog expanded from 14 to 60+ signatures.
* Bot detector refactored to a single source of truth.
* FAQ extraction cached per-post.

= 0.2.0 =
* First public release.
* AI Crawler Allowlist, Schema engine, dashboard.

= 0.1.0 =
* Initial development release.

== Upgrade Notice ==

= 0.5.2 =
Removes plugin headers not allowed on WordPress.org. No behavior changes.

= 0.5.1 =
Plugin renamed to QuotedEasy AI Readiness for WordPress.org naming compliance. No behavior changes.

= 0.5.0 =
Removes the previous post-cap limitation — every install can now use llms.txt without restrictions. The footer credit is opt-in (off by default). Security: `$_SERVER` inputs sanitized. Safe drop-in upgrade.
