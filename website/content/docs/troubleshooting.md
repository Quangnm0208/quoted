---
title: "Troubleshooting"
description: "Common issues and how to fix them."
order: 8
---

## /llms.txt returns 404

Most often a permalink issue. In WordPress Admin → **Settings → Permalinks**,
make sure the structure is anything other than "Plain". Click **Save Changes**
once to flush rewrite rules.

If it still 404s, your hosting may strip non-standard paths. The fallback
URL always works: `/index.php?rest_route=/quoted/v1/llms.txt`.

## Dashboard shows zero bot visits after a week

Three possible causes:

1. **Your host blocks AI bot user-agents.** Some shared hosts have WAF
   rules that reject `ClaudeBot`, `GPTBot`, `PerplexityBot`. Contact your
   host and ask them to whitelist these specific user-agents.
2. **Your site is brand new.** AI bots discover new content over 7–14 days.
3. **Caching plugin intercepts the request.** W3 Total Cache and WP Rocket
   may serve a cached page before Quoted&apos;s detector runs. Add an
   exclusion rule for AI bot user-agents in your cache plugin.

## Schema shows duplicates in Google Rich Results Test

You have Quoted&apos;s schema engine in **Always** mode while another SEO
plugin is also active. Switch to **Auto** mode in Quoted Settings.

If you&apos;re still seeing duplicates in Auto mode, file a bug on GitHub
with the plugin combination — Quoted maintains a conflict matrix for the
15+ SEO plugins it detects.

## Markdown endpoint returns broken UTF-8 for Vietnamese / CJK

This is rare but happens on older hosts without proper PHP `mbstring`. Ask
your host to enable the `mbstring` extension. Quoted&apos;s Markdown
serializer uses UTF-8 throughout — the issue is upstream.

## License activation fails with "Domain mismatch"

The license is bound to one specific domain to prevent resale. If you&apos;ve
moved your site (e.g. from `staging.example.com` to `example.com`), deactivate
the license in Lemon Squeezy customer portal and reactivate from the new
domain.
