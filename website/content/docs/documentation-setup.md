---
title: "Documentation Setup"
description: "Publish docs and reference pages that AI engines can crawl and cite."
order: 5
---

Quoted helps your documentation pages get picked up by AI search by:

1. Including them in `/llms.txt`.
2. Serving them as clean Markdown at `/wp-json/quoted/v1/llm/{slug}`.
3. Emitting Article (or BlogPosting) JSON-LD in Auto mode.

## Recommended structure

For documentation that AI engines will reference well:

- Use clear H1 / H2 / H3 hierarchy (don&apos;t skip levels).
- Keep paragraphs short (under 4 sentences).
- Use code blocks with the language hint (` ```bash`, ` ```php`).
- End list items with periods if they&apos;re full sentences.
- Avoid embedding critical content in images without alt text.

## Excluding pages from /llms.txt

To exclude a specific post or page from `/llms.txt`, add a custom field:

- **Name:** `quoted_exclude`
- **Value:** `1`

The page will still be reachable normally — it just won&apos;t appear in
the AI sitemap.

## Custom post types

By default, Quoted includes posts and pages. To include a custom post type
(for example, `docs`):

```php
add_filter( 'quoted_included_post_types', function ( $types ) {
    $types[] = 'docs';
    return $types;
} );
```

Add this to your theme&apos;s `functions.php` or a small companion plugin.
