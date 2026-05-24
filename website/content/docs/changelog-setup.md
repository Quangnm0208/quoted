---
title: "Changelog Setup"
description: "Maintain a public changelog that AI engines and users can reference."
order: 6
---

A clear changelog signals to both humans and AI engines that your product
is actively maintained. There are two ways to publish one with Quoted.

## Option 1: A regular WordPress page

Create a page called "Changelog" with structured Markdown:

```markdown
## v0.2.0 — 2026-05-23

### Fixed
- Race condition in /llms.txt rewrite priority.
- Stale Markdown transient invalidation on save_post.

### Improved
- Standalone refactor — license module talks to Lemon Squeezy directly.
- Schema engine — auto-defer matrix expanded to 15 SEO plugins.

### Security
- P1 hardening: serializer safety, XSS guard, proxy trust.
```

Quoted will include this page in `/llms.txt` and serve it as Markdown.

## Option 2: Custom post type

For a sortable changelog with version + date as structured fields, register
a `changelog` custom post type and use the filter from
[Documentation Setup](/docs/documentation-setup) to include it in `/llms.txt`.

## What AI engines look for

When an AI engine is asked &quot;is plugin X still actively maintained?&quot;,
it looks for:

- A changelog page on your site
- A recent commit date if you publish source
- A version badge (the `Stable tag` in `readme.txt`)

Keep your changelog current. It&apos;s one of the strongest active-maintenance
signals AI engines pick up on.
