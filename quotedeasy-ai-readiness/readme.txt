=== QuotedEasy AI Readiness ===
Contributors: muahangngayvn
Tags: ai, llms-txt, schema, ai-crawlers, seo
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.5.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI readiness for WordPress: llms.txt, clean Markdown content endpoints, AI crawler detection with allow/block controls, and JSON-LD schema.

== Description ==

QuotedEasy AI Readiness is an AI readiness layer for WordPress. It runs alongside your existing SEO plugin and adds signals that AI assistants and search engines use to find, parse, and quote your content.

= Features =

* llms.txt generator at `/llms.txt`.
* Per-post Markdown endpoints at `quotedeasy-ai-readiness/v1/llm/{slug}`.
* Detection for 60+ AI crawler user-agents (Anthropic, OpenAI, Google Gemini, Perplexity, Mistral, xAI Grok, DeepSeek, Cohere, Apple Intelligence, Meta AI, Amazon, ByteDance, Alibaba, Baidu, Naver, Yandex, plus training-corpus and SEO crawlers).
* Per-bot allow/block list. Blocked bots receive HTTP 403 and a matching Disallow rule in `/robots.txt`.
* Article (or BlogPosting) and FAQPage JSON-LD on single posts. Auto-defers Article schema to Yoast, Rank Math, AIOSEO, SEOPress, Slim SEO, The SEO Framework, Squirrly, WP Meta SEO, Schema, and Schema Pro when active.
* Local dashboard: AI Distribution Score, top crawling bots, recent crawls, next-action prompts.
* Visitor IPs are SHA-256 hashed before storage; full kill switch in Settings.
* UTF-8 throughout.

= AI engines tracked =

ChatGPT (GPTBot, ChatGPT-User, OAI-SearchBot, Operator), Claude (ClaudeBot, Claude-User, Claude-SearchBot), Perplexity (PerplexityBot, Perplexity-User), Google AI Overviews & Gemini (Google-Extended, GoogleOther), Apple Intelligence (Applebot-Extended), Meta AI, Mistral, xAI Grok, DeepSeek, Cohere, Amazon, ByteDance/Doubao, Alibaba/Tongyi, Baidu ERNIE, Naver CLOVA X, Yandex, Sogou, Huawei PetalBot, You.com, Phind, Kagi, Andi, Komo, AI2Bot, Common Crawl, LAION FriendlyCrawler, Hive ImagesiftBot, Diffbot, Semantic Scholar, TimpiBot, PleiasBot, omgilibot, img2dataset, Internet Archive, plus Ahrefs, Semrush, DataForSEO and MJ12. The full list is visible in **Settings > AI crawler allowlist**.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/quotedeasy-ai-readiness/`, or install via **Plugins > Add New > Upload**.
2. Activate through the **Plugins** menu.
3. The plugin opens a short setup wizard on first activation.
4. Visit **QuotedEasy > Settings** to review the AI crawler allowlist, privacy options, schema mode, and optional footer credit.
5. Open `https://your-site.com/llms.txt` to confirm the sitemap resolves.

If you use Plain permalinks, switch to any other permalink option so `/llms.txt` resolves. The REST endpoint at `/?rest_route=/quotedeasy-ai-readiness/v1/llms.txt` always works as a fallback.

== Frequently Asked Questions ==

= Does this plugin send data to external services? =

No. Everything runs on your own server. No outbound HTTP requests are made by the plugin under any configuration.

= Does this conflict with my existing SEO plugin? =

No. SEO plugins optimize for the Google search bot; this plugin optimizes for AI bots. Meta tags, sitemap.xml, and SEO settings are not touched.

In Auto mode (the default), Article schema is skipped when Yoast, Rank Math, AIOSEO, or SEOPress is active to avoid duplicate JSON-LD. FAQ schema is still emitted because most SEO plugins do not pick up shortcode-based FAQ patterns.

= Will this slow down my site? =

Bot detection is a single substring scan on the User-Agent header. The `/llms.txt` file is cached for 5 minutes.

= How does the AI crawler allowlist work? =

Every supported bot has Allow / Block radio buttons under **Settings > AI crawler allowlist**. Blocked bots receive HTTP 403 and a matching `Disallow: /` rule is added to `/robots.txt` under that bot's User-agent.

= How do I enable the "AI-ready via QuotedEasy" footer credit? =

Off by default. Enable it under **Settings > Display > Credit in footer**.

= How big does llms.txt get on a large site? =

By default it lists the 1,000 most-recently-modified published posts and pages. Increase the cap with the `quotedeasy_ai_readiness_llms_txt_post_limit` filter (pass `-1` for unlimited):

`add_filter( 'quotedeasy_ai_readiness_llms_txt_post_limit', function () { return -1; } );`

= Will my data be lost if I deactivate or delete the plugin? =

Deactivating leaves your data in place. Deleting removes the bot log table, all plugin options, and all transients.

= Does it support multibyte content (Vietnamese, Japanese, Chinese)? =

Yes. Post titles, body content, and category names are preserved in the Markdown output.

= What if my host blocks AI bot user-agents? =

Some shared hosts have WAF rules that block bot user-agents. If you see zero crawls after a week, ask your host to whitelist ClaudeBot, GPTBot, and PerplexityBot. The dashboard prompts you to check this if no bots arrive after seven days.

== External services ==

This plugin does not contact any external service. Every feature is local:

* `/llms.txt` is generated from your own posts and pages.
* Per-post Markdown is rendered from your own post content.
* Bot crawls are logged to your own database table (`{prefix}_quotedeasy_ai_readiness_bot_log`).
* Schema JSON-LD is emitted into your own pages.
* The admin dashboard reads only from your own database.

There are no accounts, API keys, license keys, or telemetry endpoints.

== Screenshots ==

1. AI Distribution Score gauge and recent bot crawls feed on the local dashboard.
2. AI Crawler Allowlist with Allow / Block toggle per bot.
3. Schema settings with master enable and Auto / Always / Never mode.
4. `/llms.txt` rendered in a browser.
5. Per-post Markdown endpoint output.
6. Settings > Privacy: IP hashing toggle, kill switch, trust-proxy opt-in.
7. Welcome wizard on first activation.

== Changelog ==

= 0.5.2 =
* Removed plugin headers not permitted on WordPress.org hosted plugins (`Network: false`, `Update URI: false`).
* Updated "Tested up to" header.
* General code cleanup.

= 0.5.1 =
* Renamed from Quoted to QuotedEasy AI Readiness for WordPress.org naming compliance.
* All internal class names, constants, option names, REST namespace, AJAX actions, CSS/JS handles, and the bot log database table renamed to the new prefix.
* No behavior changes.

= 0.5.0 =
* Free build with no caps, no license check, no upgrade prompts.
* No external services.
* Footer credit is opt-in (off by default).
* Sanitized `$_SERVER` inputs (User-Agent, REQUEST_URI, forwarded IPs).
* JSON-LD output hex-escaped against `<`, `>`, `&`, `'`, `"`.
* llms.txt default cap raised to 1,000, filterable.
* Per-post Markdown URLs use `rest_url()` so they survive `rest_url_prefix` filters.
* Cleaner uninstall: removes the bot log table, plugin options, and transients.

= 0.4.1 =
* Onboarding fix: completing the wizard now reaches the dashboard.
* JSON-LD escaping hardened.
* Bot log pruning at 10,000 rows.

= 0.3.0 =
* Bot catalog expanded from 14 to 60+ signatures.
* FAQ extraction cached per-post.

= 0.2.0 =
* First public release.

= 0.1.0 =
* Initial development release.

== Upgrade Notice ==

= 0.5.2 =
Removes plugin headers not allowed on WordPress.org. No behavior changes.

= 0.5.1 =
Plugin renamed to QuotedEasy AI Readiness for WordPress.org naming compliance. No behavior changes.
