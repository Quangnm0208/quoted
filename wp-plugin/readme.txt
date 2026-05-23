=== Quoted — Make your WordPress site AI-readable ===
Contributors: nguyenmanhquang
Donate link: https://quotedeasy.com
Tags: ai, llms.txt, chatgpt, claude, perplexity
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.2.0
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
* **14 AI bot signatures** detected automatically: ClaudeBot, GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Bytespider, Meta-ExternalAgent, CCBot, DiffBot, cohere-ai, YouBot.
* **AI Crawler Allowlist** — allow or block any of the 14 bots one by one. Blocked bots get HTTP 403 + a `Disallow` rule in your robots.txt.
* **Schema engine** — Article (or BlogPosting) and FAQPage JSON-LD on single posts. Auto-detects FAQ from `[faq_item]` shortcodes and H2/H3 question patterns. Defers to Yoast / Rank Math / AIOSEO / SEOPress when they're active.
* **Local-first dashboard** — AI Distribution Score, top crawling bots, recent crawls feed, posts synced quota. Reads from your own database. Nothing sent to external servers.
* **Privacy by default** — visitor IPs are SHA-256 hashed before storage. Toggle off entirely if you prefer. GDPR/CCPA-friendly.
* **< 2 ms overhead** per pageview — one substring scan on the User-Agent header.
* **Multi-language** — UTF-8 safe; tested with French accents, Vietnamese diacritics, Japanese kanji, CJK characters.

= ⭐ What Pro adds =

A Pro license from [quotedeasy.com](https://quotedeasy.com) unlocks (via Lemon Squeezy checkout):

* **Unlimited posts** in llms.txt (free tier caps at 50)
* **12 months** of bot history (free is 7 days)
* **Citation tracking** with your own Perplexity/Tavily API key — we never proxy your queries or use our credits
* **Live AI Test** — ask AI a question and see if your site is cited
* **Niche benchmark** (Pro+) — compare your AI distribution vs competitors
* **Bot whitelist/blocklist by category** (Pro+)
* **Up to 5 sites per license** (Solo) or 30 (Pro+)
* **Remove the "Powered by Quoted" badge** in footer
* **Priority support** (Pro+, 24h SLA)

Pricing: Solo $19/mo, Pro+ $39/mo. 14-day money-back. See [quotedeasy.com/pricing](https://quotedeasy.com).

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

This plugin connects to external services in the following situations. **None of these activate on the Free tier without explicit license activation.**

= Lemon Squeezy License API (Pro only) =

When you activate a Pro license, the plugin sends a POST request to `https://api.lemonsqueezy.com/v1/licenses/activate` with your license key and the site's hostname. Once daily, it revalidates by POSTing to `https://api.lemonsqueezy.com/v1/licenses/validate`. The plugin stores the instance ID returned by Lemon Squeezy locally so you can deactivate the seat later.

* **What we send:** license key, site hostname.
* **What we don't send:** post content, user data, page views, any analytics.
* **Terms of service:** https://www.lemonsqueezy.com/legal/terms-of-service
* **Privacy policy:** https://www.lemonsqueezy.com/legal/privacy

= Lemon Squeezy hosted checkout (when upgrading) =

The Upgrade page contains anchor links to `https://YOUR-STORE.lemonsqueezy.com/buy/...`. Clicking opens Lemon Squeezy's hosted checkout in a new tab. No data is sent from the plugin to Lemon Squeezy until you click. Subject to Lemon Squeezy's own terms/privacy linked above.

= Perplexity AI / Tavily (Pro only, BYO key) =

When you paste a Perplexity or Tavily API key into Settings and trigger a Live AI Test or Citation Check, the plugin posts your query directly from your WordPress server to `https://api.perplexity.ai` or `https://api.tavily.com` using **your** API key. Quoted never sees the query.

* Perplexity terms: https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service
* Perplexity privacy: https://www.perplexity.ai/hub/legal/privacy-policy
* Tavily terms: https://tavily.com/terms

== Screenshots ==

1. AI Distribution Score gauge + recent bot crawls feed on the local dashboard.
2. AI Crawler Allowlist — Allow / Block toggle per bot with the bot operator (Anthropic, OpenAI, Perplexity, etc.) shown beneath the bot name.
3. Schema settings — master enable + Auto / Always / Never mode. The Auto label calls out the active SEO plugin so you know why Article is being deferred.
4. llms.txt rendered output in the browser, with site description and the latest 50 posts.
5. Per-post markdown endpoint — clean Markdown body, no ads, no scripts.
6. Settings → Pro feature API keys — BYO Perplexity and Tavily key fields (gated by license).
7. Upgrade page — 3 pricing tiers, transparent monthly pricing, secure Lemon Squeezy checkout.
8. Onboarding step 1 — paste license key or skip to start on the Free plan.

== Changelog ==

= 0.2.0 =
* Standalone refactor — plugin now ships fully self-contained. No backend hop, no JWT token lifecycle. License talks directly to Lemon Squeezy's License API.
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

= 0.2.0 =
Major refactor: plugin is now fully standalone. The "Backend URL" setting is gone (now irrelevant). New AI Crawler Allowlist and Schema engine sections appear in Settings. Existing license activations need to be re-done once via the new License section in Settings (Quoted now talks directly to Lemon Squeezy).
