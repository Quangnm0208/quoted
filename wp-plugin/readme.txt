=== Quoted — AI Citation Tracker ===
Contributors: nguyenmanhquang
Tags: ai, llm, llms.txt, citations, seo, chatgpt, claude, perplexity
Requires at least: 6.0
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: Proprietary
License URI: https://quoted.io/license

Make your WordPress site AI-readable. Track when ChatGPT, Claude, and Perplexity cite your content.

== Description ==

Quoted helps WordPress sites become first-class citizens of the AI search era.

**What it does:**

* Generates an `llms.txt` file (the AI-bot equivalent of `sitemap.xml`)
* Serves clean Markdown versions of your posts at `/wp-json/quoted/v1/llm/{slug}`
* Detects when AI bots (ClaudeBot, GPTBot, PerplexityBot, GoogleExtended, …) crawl your site
* Shows you a dashboard of AI bot activity — see exactly which AI is reading you
* Tracks citations when ChatGPT, Claude, and Perplexity quote your content (Pro)

**Why it exists:**

Your existing SEO plugin makes you findable by Google. Quoted makes you
findable, readable, and quotable by AI. As AI search displaces traditional
search, the sites that ship llms.txt early get the long-tail citation flywheel.

**Free plan:**

* Up to 50 posts
* llms.txt generation
* Bot crawl tracking (last 7 days)
* AI Distribution Score
* "Powered by Quoted" footer badge

**Pro plan ($19/mo):**

* Unlimited posts
* 12-month bot activity history
* Citation tracking (Perplexity, ChatGPT, Claude)
* Live AI Test (ask AI questions and see if it cites you)
* Per-category configuration
* Bot whitelist/blocklist
* Niche benchmark
* Remove footer badge

== Installation ==

1. Upload the plugin to `/wp-content/plugins/quoted/` (or install via Plugins → Add New)
2. Activate through the 'Plugins' menu in WordPress
3. Get a license key at https://quoted.io/signup (free)
4. Go to **Quoted** in the admin sidebar and complete the 8-click onboarding

== Frequently Asked Questions ==

= Does this slow down my site? =

Bot detection adds less than 2 milliseconds to a frontend pageview.
llms.txt is cached at the edge.

= Does this share my content with AI companies? =

It helps them read your already-public content in a clean format.
We do not send your content to AI companies — they fetch it themselves
from your `llms.txt` endpoint. You can opt out per category at any time.

= Does this block AI bots? =

No. By default, we welcome them and log their visits. You can configure
per-bot blocking on the Pro plan.

= Will this affect my Google rankings? =

No. `llms.txt` is read by AI bots, not Google. Your existing SEO setup
is unaffected.

= What if my host blocks AI bot user-agents? =

Some shared hosts have WAF rules that block bot user-agents. If you see
zero crawls after a week, contact your host and ask them to whitelist
ClaudeBot, GPTBot, and PerplexityBot.

== Screenshots ==

1. Dashboard with real-time AI bot activity
2. 8-click onboarding wizard
3. Bot activity feed with timestamps
4. AI Distribution Score gauge
5. Settings — privacy and display options

== Changelog ==

= 0.1.0 =
* Initial release
* 8-click onboarding
* llms.txt generation
* Markdown endpoints
* 14 AI bot user-agents tracked
* Free tier with 50-post limit

== Upgrade Notice ==

= 0.1.0 =
First public release. Free to install and use.
