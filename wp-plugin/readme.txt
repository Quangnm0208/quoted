=== Quoted - AI Citation Tracker for WordPress ===
Contributors: nmquang
Donate link: https://quoted.io/donate
Tags: ai, llms-txt, seo, analytics, chatgpt
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Track when ChatGPT, Claude, Perplexity cite your content. Free AI bot tracking and llms.txt generation for WordPress.

== Description ==

**Quoted** helps WordPress site owners understand how AI search engines interact with their content. Track every visit from ChatGPT, Claude, Perplexity, and other AI assistants. Generate `llms.txt` automatically. Know when AI cites you.

**Why Quoted?**

Search behavior is shifting. People ask ChatGPT and Claude instead of Googling. Your content may be feeding AI answers — but you have no way to know which content, how often, or whether you are credited.

Quoted fixes that.

**Key features (Free):**

* **AI bot activity log** — see exactly when GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers visit your site
* **60+ AI bot signatures** detected automatically — every major LLM operator (Anthropic, OpenAI, Google Gemini, Microsoft Copilot, Perplexity, Mistral, xAI Grok, DeepSeek, Cohere, Apple Intelligence, Meta AI, Amazon, ByteDance, Alibaba, Baidu, Naver, Yandex), every relevant training-corpus crawler (Common Crawl, AI2, LAION FriendlyCrawler, Hive ImagesiftBot, Diffbot, Semantic Scholar), and the SEO crawlers that resell data to LLM training pipelines (Ahrefs, Semrush, DataForSEO, MJ12)
* **llms.txt auto-generation** — creates the standard file AI search engines use to understand your site structure, served at `/llms.txt` (up to 50 posts on Free)
* **Clean Markdown endpoints** — every post serves AI-friendly Markdown at `/wp-json/quoted/v1/llm/{slug}`. AI parses 10x faster than HTML.
* **AI Crawler Allowlist** — allow or block any of the 60+ bots one by one. Blocked bots get HTTP 403 + a `Disallow` rule in robots.txt.
* **Schema markup enhancement** — auto-inject Article and FAQPage JSON-LD to make content more citable. Detects 16 active SEO plugins (Yoast, RankMath, AIOSEO, SEOPress, Slim SEO, SEO Framework, etc.) and defers when they're emitting their own schema.
* **Local-first dashboard** — AI Distribution Score, top crawling bots, recent crawls feed, posts synced quota. Reads from your own database. Nothing sent to external servers.
* **Privacy by default** — visitor IPs are SHA-256 hashed before storage. Toggle off entirely if you prefer.

**Coming soon (Pro):**

* **Citation alerts** — get notified when AI assistants quote your content (BYO Perplexity/Tavily API key — your queries never proxy through us)
* **Live AI Test** — ask AI a question and see if your site is cited
* **Niche benchmark** — compare your AI distribution vs competitors
* **Unlimited posts** in llms.txt (Free tier caps at 50)
* **12 months** of bot history (Free is 7 days)
* **Multi-site license** — up to 5 sites (Solo) or 30 sites (Pro+)
* **Remove the "Powered by Quoted" badge** in footer
* **Priority support** (24h SLA)

Pro launches at [quoted.io](https://quoted.io). The Pro UI auto-appears inside this plugin once the store is wired up — no separate install needed.

**External services notice:**

The Free release of Quoted does NOT connect to any external server. Everything runs locally on your WordPress site. When Pro launches, paid features will route through Lemon Squeezy's License API (for license validation) and call the AI provider you choose (Perplexity / Tavily) directly using YOUR API key — Quoted never proxies your queries. See the Privacy section below for details.

**Resources:**

* [Documentation](https://quoted.io/docs)
* [Support forum](https://wordpress.org/support/plugin/quoted/)

== Installation ==

**Automatic installation (recommended)**

1. Go to Plugins → Add New in your WordPress admin
2. Search for "Quoted"
3. Click "Install Now" then "Activate"
4. Go to Quoted in your admin menu to start tracking

**Manual installation**

1. Download the plugin .zip from WordPress.org
2. Upload via Plugins → Add New → Upload Plugin
3. Activate the plugin
4. Go to Quoted in your admin menu

**Setup (takes 30 seconds)**

1. Activate the plugin. The setup wizard opens automatically.
2. Click "Let's go" — Free tier needs no account.
3. Confirm Settings → Permalinks is set to anything other than "Plain" (so the AI sitemap at `/llms.txt` resolves cleanly).
4. Wait 24-48 hours, then check the Quoted dashboard to see your first AI bot visits.

== Frequently Asked Questions ==

= Is this free? =

Yes. The core features — AI bot tracking (60+ bots), llms.txt generation, Markdown endpoints, AI crawler allowlist, schema injection, local dashboard — are free forever, no account required, no data leaves your server. Pro features (citation alerts, multi-site, BYO API key) launch at [quoted.io](https://quoted.io) and require a paid subscription.

= Does the free version send my data anywhere? =

No. The free version operates entirely on your WordPress site. No outbound HTTP. No external account. No telemetry. See the Privacy section below.

= Will this slow down my site? =

No. Bot detection is a single substring scan on the User-Agent header — under 2ms per pageview. The `/llms.txt` file is cached for 5 minutes and served with short browser-cache headers (no aggressive edge cache, so post updates propagate fast). Schema JSON-LD is generated server-side as static JSON in `<head>`. We've tested on sites with 200+ posts and 50+ simultaneous bot requests — no measurable impact.

= How is this different from Google Analytics? =

Google Analytics tracks human visitors. Quoted tracks AI bots — ChatGPT, Claude, Perplexity, and 57 others. These are different traffic sources captured differently. AI bots are filtered out of GA's reports. You need both for a full picture.

= Does this conflict with my existing SEO plugin (Yoast / Rank Math / AIOSEO / SEOPress)? =

No. Quoted is designed to coexist. The Schema engine actively detects 16 SEO plugins on your site and, in Auto mode (the default), defers Article schema to whichever one is active so you don't get duplicate JSON-LD in Google's Rich Results test. Your existing meta tags, titles, sitemap.xml, canonicals are untouched.

= What if AI bots change their user agent? =

We maintain an up-to-date catalog of 60+ AI bot UA signatures, sourced from each provider's public documentation. The catalog ships inside the plugin as a single PHP array — when a new AI service launches, we add detection in the next minor release (typically within 1-2 weeks).

= Is this GDPR compliant? =

Yes. The free version does not collect any personal data. Visitor IPs are SHA-256 hashed before storage (or can be disabled entirely in Settings → Privacy). Bot user agents are not personal data. No data leaves your server. See the Privacy section below.

= Can I block AI bots instead of tracking them? =

Yes. Settings → AI crawler allowlist gives you Allow / Block radios per bot. Blocked bots get HTTP 403 + a `Disallow: /` rule appended to your robots.txt under each of that bot's published UA patterns. Most users let all bots through (to get cited), but the choice is yours.

= Do I need technical skills? =

No. The plugin works out of the box. Onboarding is 4 clicks total. Advanced users can customize via Quoted → Settings.

= What happens if I uninstall? =

The plugin removes its database table (`wp_quoted_bot_log`), all options, all transients, and the per-post cache-key meta. No leftover data.

= How do I get support? =

Free users: WordPress.org support forum (link above). Pro users (once launched): email support@quoted.io, response within 24 hours.

== Screenshots ==

1. Main dashboard showing AI bot activity over the last 7 days — AI Distribution Score gauge, recent crawls feed, top bots chart.
2. AI Crawler Allowlist — Allow / Block toggle per bot, grouped by operator (Anthropic, OpenAI, Google, Perplexity, Mistral, xAI, etc.).
3. Schema settings — master enable + Auto / Always / Never mode. Auto label calls out the active SEO plugin so you know why Article is being deferred.
4. llms.txt rendered in the browser — site description + the 50 most-recent posts.
5. Per-post Markdown endpoint — clean Markdown body, no ads, no scripts.
6. Settings → Privacy — IP hashing, kill switch, trust-proxy opt-in.
7. Welcome screen on first activation — Free tier ready in one click.

== Changelog ==

= 0.3.0 =
* **Bot catalog expanded from 14 → 60+ signatures.** Now covers Anthropic Claude-User + Claude-SearchBot, OpenAI Operator, Google GoogleOther + GoogleOther-Image, Microsoft Bingbot/MSNBot, Mistral, xAI Grok, DeepSeek, Amazon, Alibaba, Baidu (Baiduspider + Baidu-AI), Naver Yeti + NaverGPT, Yandex, Sogou, Huawei PetalBot, AI2Bot (Allen Institute), Hive ImagesiftBot, LAION FriendlyCrawler, Semantic Scholar, omgilibot, TimpiBot, PleiasBot, img2dataset, and the SEO crawlers (Ahrefs, Semrush, DataForSEO, MJ12) that resell data to LLM training pipelines. Plus Internet Archive's ia_archiver.
* Refactor: bot detector now has a single `bot_catalog()` source of truth. `bot_signatures()` and `bot_metadata()` derive from it.
* Perf: `wp_quoted_bot_log` unsynced count cached in a 60-second transient. Eliminates the SELECT COUNT(*) on ~99% of bot hits.
* Perf: FAQ extraction (`do_blocks()` + H2/H3 question regex) cached per-post in a 12h transient + per-request static.
* UX: dropped the obsolete "niche" onboarding step. Onboarding is 4 steps instead of 5.
* Cleanup: removed dead `ajax_save_niche` AJAX handler + JS markup, removed unused `i18n.syncing` localization, slimmed onboarding partial by 30+ lines of dead niche-picker UI.

= 0.2.0 =
* **First public release — Free tier.** Plugin ships fully self-contained — no backend, no SaaS proxy, no required external service.
* AI Crawler Allowlist (allow/block per bot, robots.txt rule injection, HTTP 403 enforcement on blocked bots).
* Schema Engine (Article + FAQPage JSON-LD with SEO-plugin conflict detection across 16 plugins).
* Local-first dashboard reading from `wp_quoted_bot_log` table.
* Markdown endpoint per post (raw text/markdown, not JSON-wrapped).
* Multisite refuse + DOMDocument guard + admin notice for Plain permalinks + 7-day "no bots detected" advisory.
* `Cache-Control: max-age=300, must-revalidate` on /llms.txt — no aggressive edge cache that holds stale content after post edits.

= 0.1.0 =
* Initial scaffold (private)
* 8-click onboarding
* llms.txt generation
* Markdown endpoints (JSON-wrapped — fixed in 0.2.0)
* 14 AI bot user-agents tracked (expanded to 60+ in 0.3.0)

== Upgrade Notice ==

= 0.3.0 =
Major bot-catalog expansion (14 → 60+ signatures). Performance improvements on the bot log and FAQ schema extraction. Removed the unused niche onboarding step. Safe drop-in upgrade.

= 0.2.0 =
First public release. Free tier — no account needed, no data leaves your server.

== Privacy ==

**What data the Free version processes**

When an AI bot visits your site, Quoted logs:

* The bot identifier (e.g. `ClaudeBot`, `GPTBot`) — extracted from the User-Agent header
* Timestamp of visit (UTC)
* Request URL path
* Truncated User-Agent string (up to 512 chars)
* Hashed IP address (SHA-256 of IP + a per-site salt) — or disabled entirely if you uncheck "Hash IPs" in Settings → Privacy

All of this is stored in your WordPress database in the `wp_quoted_bot_log` table. **Nothing is sent to any external server in the Free version.** No telemetry. No phone-home. No analytics.

**What the Free version does NOT process**

* No personal data of human visitors — bot detection only fires for the 60+ known AI bot UAs.
* No post content is ever transmitted off your server.
* No user IDs, no login data, no session data.

**External services (Pro tier only — not active in this release)**

When the Pro tier launches at [quoted.io](https://quoted.io), it will introduce these outbound HTTP calls. Each is opt-in and described below for transparency. None of them activate until you explicitly enter a Pro license key.

* `https://api.lemonsqueezy.com/v1/licenses/activate` — when you activate a license key. Payload: license key + your site hostname. Used to validate the seat and look up your subscription plan.
* `https://api.lemonsqueezy.com/v1/licenses/validate` — once daily via cron. Same payload. Confirms the seat is still active so a cancelled subscription downgrades to Free.
* `https://api.lemonsqueezy.com/v1/licenses/deactivate` — when you press "Deactivate license" in Settings.
* `https://STORE.lemonsqueezy.com/buy/VARIANT` — the Lemon Squeezy hosted checkout, opened in a new tab when you click "Upgrade". No data is sent from the plugin to LS until you click.
* `https://api.perplexity.ai` and `https://api.tavily.com` — only fired if you paste a Perplexity or Tavily API key into Settings AND trigger a Live AI Test or Citation Check. Quoted posts your query directly using YOUR API key — we never proxy and we never see the query.

**Third-party services policies**

* Lemon Squeezy (Merchant of Record for payments): https://www.lemonsqueezy.com/legal/privacy
* Perplexity AI: https://www.perplexity.ai/hub/legal/privacy-policy
* Tavily: https://tavily.com/terms

**Your rights**

You can export or delete all data Quoted holds locally via:

* WordPress Tools → Export Personal Data
* WordPress Tools → Erase Personal Data
* Uninstalling the plugin removes the `wp_quoted_bot_log` table, all `quoted_*` options, all `_transient_quoted_*` transients, and all `_quoted_md_cache_key` post-meta entries.

For data we hold on the Pro tier service (once launched), email privacy@quoted.io.

**Disable external connections entirely**

To run only the Free, fully-local features:

* Do not enter a Pro license key in Settings.
* Do not paste any API key into the Pro feature fields.

That's the default state on activation. The plugin makes no outbound HTTP calls until you opt in.

Last updated: 2026-05-23
