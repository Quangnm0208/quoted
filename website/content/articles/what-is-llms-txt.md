---
title: "What is llms.txt and why does your WordPress site need one?"
description: "A practical introduction to the llms.txt spec, why AI engines need it, and how WordPress sites can ship one in under a minute."
date: "2026-05-20"
author: "Quoted team"
tags: ["llms.txt", "AI SEO", "WordPress"]
---

`llms.txt` is to AI search what `sitemap.xml` is to Google: a single file that
tells AI crawlers what content lives on your site, in a format they can read
without bouncing off ads, popups, or JavaScript.

The spec was proposed by Mistral and Anthropic in September 2024, and within
a year it became the de-facto standard for AI-ready websites.

## Why your site needs one

AI engines like ChatGPT, Claude, and Perplexity *can* crawl your HTML — but
they typically lose 80–90% of your content to chrome elements: navigation
menus, ad slots, cookie banners, social share widgets, recommended-article
sections, and JavaScript that doesn&apos;t render server-side.

`llms.txt` solves this with a clean, predictable index. AI bots fetch
`/llms.txt`, see a list of your important URLs, and follow each link to a
clean Markdown version of the content.

## What goes in llms.txt

A minimal `llms.txt` looks like this:

```
# My WordPress Site

> A short site description for AI engines.

## Articles
- [Best running shoes 2026](https://example.com/best-running-shoes/)
- [How to train for a marathon](https://example.com/marathon-training/)

## Pages
- [About](https://example.com/about/)
- [Contact](https://example.com/contact/)
```

That&apos;s it. No XML, no schema gymnastics. Just Markdown.

## How to ship it on WordPress

You have three options:

1. **Hand-write it.** Create the file, upload to your web root, update it
   every time you publish.
2. **Build it with Claude or Cursor.** Spin up a script, debug WP-Cron,
   maintain it forever.
3. **Install a plugin like [Quoted](https://wordpress.org/plugins/quoted/).**
   Auto-generated from your published posts, cached at the edge, served at
   both `/llms.txt` and `/wp-json/quoted/v1/llms.txt`.

The third option takes about 30 seconds. The plugin also serves a clean
Markdown version of each post at `/wp-json/quoted/v1/llm/{slug}`, so AI
crawlers don&apos;t have to parse your HTML at all.

## What happens after you ship one

AI crawlers find your `llms.txt` within days. You&apos;ll start seeing
`ClaudeBot`, `GPTBot`, `PerplexityBot`, and `OAI-SearchBot` user-agents in
your access logs. If you&apos;re running Quoted, the dashboard shows these
visits in a clean feed within 24 hours of install.

What you do with that signal — block the scrapers, allow the citers, track
which posts get cited — is the next step.
