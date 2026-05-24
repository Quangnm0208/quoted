=== Quoted — Make your WordPress site AI-readable ===
Contributors: nguyenmanhquang
Donate link: https://quotedeasy.com
Tags: ai, llms.txt, chatgpt, claude, perplexity
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.3.1
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Make your WordPress site readable by ChatGPT, Claude, Perplexity, and Google AI. Auto llms.txt + Markdown endpoints + per-bot allow/block.

== Description ==

**Quoted is the AI-readability layer for WordPress.** Get your content discovered, parsed, and cited by ChatGPT, Claude, Perplexity, Google AI Overviews, Gemini, and every other AI search engine.

It runs **alongside** your existing SEO plugin (Yoast, Rank Math, AIOSEO, SEOPress) — never touches your titles, meta descriptions, canonicals, or sitemaps. It only adds the layer those plugins don't have: AI bot signals.

= 🆓 What you get free =

**No account required. No data leaves your server.**

* **llms.txt auto-generator** — the AI-bot equivalent of sitemap.xml, served at `/llms.txt`. Up to 50 posts on the free tier.
* **Clean Markdown endpoints** — every post serves clean, AI-friendly Markdown at `/wp-json/quoted/v1/llm/{slug}`. AI parses 10× faster than HTML.
* **60+ AI bot signatures** detected automatically — every major LLM operator (Anthropic, OpenAI, Google Gemini, Perplexity, Mistral, xAI Grok, DeepSeek, Cohere, Apple Intelligence, Meta AI, Amazon, Bytedance, Alibaba, Baidu, Naver, Yandex), every relevant training-corpus crawler (Common Crawl, AI2, LAION FriendlyCrawler, Hive ImagesiftBot, Diffbot), and the SEO crawlers that resell data to LLM training pipelines (Ahrefs, Semrush, DataForSEO, MJ12).
* **AI Crawler Allowlist** — allow or block any of those 60+ bots one by one. Blocked bots get HTTP 403 + a `Disallow` rule in your robots.txt.
* **Schema engine** — Article (or BlogPosting) and FAQPage JSON-LD on single posts. Auto-detects FAQ from `[faq_item]` shortcodes and H2/H3 question patterns. Defers to Yoast / Rank Math / AIOSEO / SEOPress when they're active.
* **Local-first dashboard** — AI Distribution Score, top crawling bots, recent crawls feed, posts synced quota. Reads from your own database. Nothing sent to external servers.
* **Privacy by default** — visitor IPs are SHA-256 hashed before storage. Toggling off "Hash IPs" stores the raw IP (prefixed `raw:`) instead, for operators who need the original value. To not store any IP information at all, toggle "Disable bot logging" in Settings → Privacy.
* **< 2 ms overhead** per pageview — one substring scan on the User-Agent header.
* **Multi-language** — UTF-8 safe; tested with French accents, Vietnamese diacritics, Japanese kanji, CJK characters.

= ⭐ Pro features (coming soon) =

The Free tier above is fully functional and will stay free forever. A paid Pro tier is in active development at [quotedeasy.com](https://quotedeasy.com), planned features:

* **Unlimited posts** in llms.txt (free tier caps at 50)
* **12 months** of bot history (free is 7 days)
* **Citation tracking** with your own Perplexity/Tavily API key — we never proxy your queries or use our credits
* **Live AI Test** — ask AI a question and see if your site is cited
* **Niche benchmark** — compare your AI distribution vs competitors
* **Multi-site license** (up to 30 sites)
* **Remove the "Powered by Quoted" badge** in footer
* **Priority support**

Pricing and exact launch date will be announced at [quotedeasy.com](https://quotedeasy.com). Subscribe there to be notified.

= 🤖 AI engines supported =

ChatGPT, ChatGPT Search, Perplexity AI, Claude, Google AI Overviews, Gemini, Apple Intelligence, Meta AI, Bytespider, Common Crawl, Cohere, Diffbot, You.com.

= 💡 Why it exists =

Your existing SEO plugin makes you findable by Google. **Quoted makes you findable, readable, and quotable by AI.** As AI search displaces traditional search, the sites that ship `llms.txt` early get the long-tail citation flywheel.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/quoted/` (or install via Plugins → Add New → Upload).
2. Activate through the **Plugins** menu in WordPress.
3. The plugin auto-redirects you to a short setup wizard. Skip it to use the Free plan, or paste a Pro license key from your purchase email.
4. Visit `Quoted → Settings` to review the AI crawler allowlist, privacy options, and (Pro) BYO API keys.
5. Confirm `/llms.txt` resolves by visiting `https://your-site.com/llms.txt` in a browser. You should see the auto-generated AI sitemap.

== Frequently Asked Questions ==

= Does this conflict with my existing SEO plugin (Yoast, Rank Math, AIOSEO, SEOPress)? =

No. Yoast / Rank Math / AIOSEO / SEOPress optimize for the Google search bot. Quoted optimizes for AI bots — they read your site in different ways. Quoted doesn't touch your existing meta tags, sitemap.xml, or any SEO settings. Your Google ranking is unchanged.

The Schema engine is smart about this — in **Auto mode** (the default), Quoted detects active SEO plugins and skips Article schema to avoid duplicate JSON-LD. FAQ schema is still emitted because most SEO plugins don't pick up shortcode-based FAQ patterns.

= AI bots already crawl my site. Why do I need a plugin? =

Yes, AI bots crawl HTML — but they bounce off ads, popups, JavaScript, and navigation chrome, losing about 90% of your content in the process. The `llms.txt` spec (proposed by Mistral and Anthropic in September 2024) is the AI-native answer. Sites that ship it early get cited more often.

= Will this slow down my site? =

No. Bot detection is a single substring scan on the User-Agent header — under 2ms per pageview. The `/llms.txt` file is cached for 5 minutes and served with edge cache headers.

= How does the AI Crawler Allowlist work? =

In Settings → AI Crawler Allowlist, you'll see all 14 supported bots with Allow / Block radios. Blocked bots get HTTP 403 when they request a page, and a `Disallow: /` rule appended to your robots.txt under that bot's User-agent. Bots that respect robots.txt will stop crawling on their own; the 403 covers the ones that don't. Crawls are still logged before the 403, so your dashboard shows the blocked attempts.

= What about the Schema engine? It says it won't conflict with my SEO plugin? =

Right. In **Auto** mode (default), the Schema engine checks `is_plugin_active()` for Yoast, Yoast Premium, Rank Math, Rank Math Pro, AIOSEO, AIOSEO Pro, SEOPress, and SEOPress Pro. If any are active, Quoted skips its own Article schema so Google's Rich Results Test doesn't see duplicates. FAQ schema is still emitted — it's auto-detected from `[faq_item question="…"]Answer[/faq_item]` shortcodes (common in plugins like Easy FAQ and Quick & Easy FAQs) and from H2/H3 headings that end in `?`.

You can override with **Always** (output both regardless) or **Never** (suppress Article only).

= Do you proxy my data through your servers? =

**No.** Quoted is a standalone plugin. The only outbound HTTP call is to Lemon Squeezy's License API for license validation (once daily) when you have a Pro license. Pro features that call AI APIs (Perplexity, Tavily) use **your own API key**, configured in Settings — we never see your queries or charge you per call.

= What if my host blocks AI bot user-agents? =

Some shared hosts have WAF rules that block bot user-agents. If you see zero crawls after a week, contact your host and ask them to whitelist ClaudeBot, GPTBot, and PerplexityBot.

= Will my data be lost if I cancel Pro? =

No. The bot crawl log lives in your own database (table `wp_quoted_bot_log`). If you cancel, you revert to the Free tier — you keep `llms.txt`, Markdown endpoints, schema, allowlist, and 7-day local bot history. Only the long-history view and Pro-only features lock.

= I have multibyte content (Vietnamese, Japanese, Chinese). Will it work? =

Yes. Quoted is UTF-8 throughout. Post titles, body content, and category names survive intact in the Markdown output. Note: WordPress's built-in slug generator strips CJK characters from URLs — that's a core WP behavior, not a Quoted limitation. For Japanese/Chinese sites, install a transliteration plugin if you want readable slugs.

== External services ==

**This Free release of Quoted does not connect to any external service.** Everything happens on your own server: llms.txt is generated from your local posts, Markdown is rendered from your local content, bot crawls are logged to your local database, schema is emitted into your own pages, and the dashboard reads only from your `wp_quoted_bot_log` table.

The integrations below are described for transparency — they will activate **only after the Pro tier launches** and only if you choose to activate a paid license. Until then, none of these URLs are hit by the plugin.

= Lemon Squeezy License API (Pro only — not active in this release) =

When you activate a Pro license, the plugin sends a POST request to `https://api.lemonsqueezy.com/v1/licenses/activate` with your license key and the site's hostname. Once daily, it revalidates by POSTing to `https://api.lemonsqueezy.com/v1/licenses/validate`. The plugin stores the instance ID returned by Lemon Squeezy locally so you can deactivate the seat later.

* **What we send:** license key, site hostname.
* **What we don't send:** post content, user data, page views, any analytics.
* **Terms of service:** https://www.lemonsqueezy.com/legal/terms-of-service
* **Privacy policy:** https://www.lemonsqueezy.com/legal/privacy

= Lemon Squeezy hosted checkout (Pro only — not active in this release) =

When Pro launches, the Upgrade page will contain anchor links to `https://STORE.lemonsqueezy.com/buy/...`. Clicking opens Lemon Squeezy's hosted checkout in a new tab. No data is sent from the plugin to Lemon Squeezy until you click. Subject to Lemon Squeezy's own terms/privacy linked above.

= Perplexity AI / Tavily (Pro only, BYO key, not active in this release) =

After Pro launches: when you paste a Perplexity or Tavily API key into Settings and trigger a Live AI Test or Citation Check, the plugin will post your query directly from your WordPress server to `https://api.perplexity.ai` or `https://api.tavily.com` using **your** API key. Quoted never sees the query.

* Perplexity terms: https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service
* Perplexity privacy: https://www.perplexity.ai/hub/legal/privacy-policy
* Tavily terms: https://tavily.com/terms

== Screenshots ==

1. AI Distribution Score gauge + recent bot crawls feed on the local dashboard.
2. AI Crawler Allowlist — Allow / Block toggle per bot with the bot operator (Anthropic, OpenAI, Perplexity, etc.) shown beneath the bot name.
3. Schema settings — master enable + Auto / Always / Never mode. The Auto label calls out the active SEO plugin so you know why Article is being deferred.
4. llms.txt rendered output in the browser, with site description and the latest 50 posts.
5. Per-post markdown endpoint — clean Markdown body, no ads, no scripts.
6. Settings → Privacy — IP hashing toggle, disable-logging kill switch, trust-proxy opt-in.
7. Welcome screen on first activation — Free tier ready in one click.

== Changelog ==

= 0.3.1 =
* **Fix:** Free badge now renders deterministically. The previous logic returned early when no license was connected — but Free users by definition aren't connected, so the "Powered by Quoted" badge never appeared on the Free tier (where it's mandatory). Badge logic is centralised in a single function: Free → always render, Paid → respect `quoted_show_badge`, expired/revoked license → reverts to Free behaviour.
* **Fix:** Dashboard quota card no longer shows "X / 0 posts synced" for unlimited (paid) plans. When `posts.quota === 0` the UI renders "X posts synced (unlimited)" and hides the progress bar entirely.
* **Fix:** README privacy bullet was misleading — said "Toggle off entirely if you prefer" for the Hash IPs setting. The code actually stores a `raw:<ip>` value when hashing is disabled. Wording updated to match real behaviour, plus a pointer to the "Disable bot logging" kill-switch for operators who want to store nothing.
* **Fix:** Added a runtime admin notice when the PHP `libxml` extension (DOMDocument class) is missing. Activation already wp_die()s on missing libxml, but a host can disable php-xml AFTER install — the notice surfaces the issue before the Markdown serializer fatals.
* **Doc:** `Quoted_Billing::is_configured()` docblock corrected — code uses OR (one tier is enough to show the Upgrade page), comment previously said "both tier variants".
* **Perf:** FAQ extraction transients (`quoted_faqs_<hash>`) are now invalidated on `save_post` alongside the markdown cache, instead of orphaning in `wp_options` for up to 12 hours. Same `_quoted_faqs_cache_key` post-meta tracker pattern as the existing markdown cleanup.
* No new features, no schema migration, no public API changes.

= 0.3.0 =
* **Bot catalog expanded from 14 → 60+ signatures.** Now covers Anthropic Claude-User + Claude-SearchBot, OpenAI Operator, Google GoogleOther + GoogleOther-Image, Microsoft Bingbot/MSNBot, Mistral, xAI Grok, DeepSeek, Amazon, Alibaba, Baidu (Baiduspider + Baidu-AI), Naver Yeti + NaverGPT, Yandex, Sogou, Huawei PetalBot, AI2Bot (Allen Institute), Hive ImagesiftBot, LAION FriendlyCrawler, Semantic Scholar, omgilibot, TimpiBot, PleiasBot, img2dataset, and the SEO crawlers (Ahrefs, Semrush, DataForSEO, MJ12) that resell data to LLM training pipelines. Also Internet Archive's ia_archiver — historically the largest single training-data source.
* Refactor: bot detector now has a single `bot_catalog()` source of truth. `bot_signatures()` and `bot_metadata()` derive from it, so adding a new bot is a one-line edit.
* Perf: `wp_quoted_bot_log` unsynced count is cached in a 60-second transient. Eliminates the SELECT COUNT(*) on ~99% of bot hits.
* Perf: FAQ extraction (`do_blocks()` + H2/H3 question regex) is now cached per-post in a 12h transient + per-request static. Invalidated automatically by the existing save_post hook.
* UX: dropped the obsolete "niche" onboarding step (it fed an old backend prompt-routing flow that no longer exists). Onboarding is now 4 steps instead of 5.
* Cleanup: removed dead `ajax_save_niche` AJAX handler + JS, removed unused `i18n.syncing` localization string, slimmed onboarding partial by 30+ lines of dead niche-picker markup.

= 0.2.0 =
* **First public release — Free tier.** The plugin ships fully self-contained: no backend, no SaaS proxy, no required external service.
* Paid Pro tier is in development at quotedeasy.com — the Pro UI auto-appears once the operator's Lemon Squeezy store is wired up. Until then the plugin runs Free-only.
* Architecture: standalone refactor. License module talks directly to Lemon Squeezy's License API; no JWT, no backend hop.
* New: **AI Crawler Allowlist** — Allow / Block any of 14 supported bots from Settings. Blocked bots get HTTP 403 and a `Disallow` rule in robots.txt.
* New: **Schema engine** — Article and FAQPage JSON-LD output on single posts/pages. Auto-detects active SEO plugins and defers Article to them in Auto mode. FAQ extraction from `[faq_item]` shortcodes and H2/H3 question patterns.
* New: **BYO API keys** for Pro citation tracking — Perplexity and Tavily fields in Settings.
* Dashboard rewritten to read 100% from local `wp_quoted_bot_log` — no backend call.
* Drop legacy sync module (220 lines) and the three cron hooks it scheduled.
* Trim `class-quoted-api-client.php` — no consumer left after the standalone refactor.
* Settings: drop "Backend URL" field, drop "Tenant ID" / "Niche" rows.
* Onboarding step 1: rewritten as license activation (or skip to Free).
* Misc: 9 P0 bug fixes from the v0.1.0 → v0.1.1 audit cycle, including raw markdown emission from REST endpoints, real Chart.js 4.4.0 bundled, hash_ip inversion fix, settings save gate, save_post transient invalidation, and `/llms.txt` priority-1 template_redirect handler.

= 0.1.0 =
* Initial release
* 8-click onboarding
* llms.txt generation
* Markdown endpoints
* 14 AI bot user-agents tracked
* Free tier with 50-post limit

== Upgrade Notice ==

= 0.3.1 =
Bug-fix release. Free badge now renders for Free users. Unlimited quota no longer displays as "/ 0". README privacy wording matches code. Runtime DOMDocument check added. Safe drop-in upgrade.

= 0.3.0 =
Major bot-catalog expansion (14 → 60+ signatures). Performance improvements on the bot log and FAQ schema extraction. Removed the unused "niche" onboarding step. Safe drop-in upgrade.

= 0.2.0 =
First public release. Free tier — no account needed, no data leaves your server. Pro features coming soon.
