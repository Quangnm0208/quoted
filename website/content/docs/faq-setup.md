---
title: "FAQ Setup"
description: "How Quoted detects and emits FAQ schema from your existing content."
order: 4
---

Quoted auto-detects FAQ content from two sources, with no manual setup:

1. **`[faq_item]` shortcodes** — common in plugins like Easy FAQ and Quick
   & Easy FAQs. Pattern:

   ```
   [faq_item question="What is Quoted?"]
   A WordPress plugin that makes your site AI-readable.
   [/faq_item]
   ```

2. **H2 or H3 headings ending with a `?`** — the next paragraph is treated
   as the answer.

   ```html
   <h2>How does the allowlist work?</h2>
   <p>Block a bot in Settings → AI Crawler Allowlist. It gets HTTP 403 and a Disallow rule in robots.txt.</p>
   ```

Detected FAQ content is emitted as `FAQPage` JSON-LD on the post page.

## Why FAQ schema specifically

Most SEO plugins (Yoast, Rank Math, AIOSEO) optimize Article and Product
schema but skip FAQ — especially shortcode-based patterns. Quoted fills
that gap.

FAQ schema is the most likely to be picked up by Google&apos;s Rich Results
and by AI engines synthesizing answers, so this is high-leverage content
structure for AI search.

## Disabling FAQ schema on a specific post

Add a custom field on the post:

- **Name:** `quoted_disable_faq`
- **Value:** `1`

Quoted will skip FAQ schema emission for that post.
