# Quoted — Marketing Website

**Version:** 0.1.0
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · MDX
**Backend:** File-based content (no database, no API server)
**Billing:** Lemon Squeezy hosted checkout

This is the public marketing and sales website for the [Quoted](https://wordpress.org/plugins/quoted/)
WordPress plugin. It is intentionally simple — every page renders from
local Markdown / JSON files, so the owner can update content without
touching React.

---

## Run locally

```bash
cd website
cp .env.example .env.local      # then fill in Lemon Squeezy URLs when ready
npm install
npm run dev
```

Open <http://localhost:3000>.

## Build for production

```bash
npm run build
npm start
```

The site builds to fully static output for any host: Vercel, Cloudflare
Pages, Netlify, or your own server.

---

## How to update content (no code required)

All editable content lives in [`content/`](./content). Edit the files,
commit, push — the site rebuilds on deploy.

| What to edit | File / folder | Format |
| --- | --- | --- |
| SEO blog articles | `content/articles/*.md` | Markdown with frontmatter |
| Documentation pages | `content/docs/*.md` | Markdown with frontmatter |
| FAQ entries | `content/faq.json` | JSON |
| Changelog entries | `content/changelog.json` | JSON |
| Pricing plans / features / CTA labels | `content/pricing.json` | JSON |
| Site name, nav, footer, social, support email | `content/site.json` | JSON |

### Add a new SEO blog article

Create a file `content/articles/my-new-post.md`:

```markdown
---
title: "My new post"
description: "Short description used for SEO + previews."
date: "2026-06-01"
author: "Your name"
tags: ["AI SEO", "WordPress"]
---

Your article body in Markdown. Use H2, H3, lists, code blocks, links.
```

The slug comes from the filename. Save → the post appears on `/blog` and
at `/blog/my-new-post`.

### Update FAQ

Edit `content/faq.json`. Add an entry to the `items` array:

```json
{
  "question": "Your new question?",
  "answer": "The answer. Plain text — newlines allowed."
}
```

The page rebuilds the FAQPage JSON-LD automatically.

### Update documentation

Add or edit a file in `content/docs/`. The `order` frontmatter field
controls sidebar position. Example:

```markdown
---
title: "Advanced configuration"
description: "..."
order: 11
---
```

### Update changelog

Edit `content/changelog.json`. Add a new entry to the top of `entries`:

```json
{
  "version": "0.3.0",
  "date": "2026-06-07",
  "summary": "Zero-click onboarding ships.",
  "fixed": ["..."],
  "improved": ["..."],
  "security": [],
  "notes": "Optional footnote."
}
```

### Update Lemon Squeezy checkout links

Set these in your hosting provider&apos;s environment variables (Vercel,
Cloudflare Pages, etc.):

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_LEMONSQUEEZY_STARTER_MONTHLY_URL` | Lemon Squeezy → Product → Variant → Share tab |
| `NEXT_PUBLIC_LEMONSQUEEZY_PRO_MONTHLY_URL` | same |
| `NEXT_PUBLIC_LEMONSQUEEZY_STARTER_YEARLY_URL` | same |
| `NEXT_PUBLIC_LEMONSQUEEZY_PRO_YEARLY_URL` | same |

Until these are set, the pricing buttons render as a disabled "Checkout
link not configured" state — the site does not crash.

### Update product copy on the homepage

Most copy is inline in `app/page.tsx`. The headline, sub-headline, feature
cards, audience cards, and workflow steps are clearly named arrays at the
top of that file.

For deeper changes (changing the entire hero structure), you do need to
edit React. But for text changes (rewriting a sub-headline, swapping out
audience descriptions), you only touch string literals.

---

## SEO infrastructure

- Unique `<title>` and `<meta description>` per page via the metadata API.
- Open Graph + Twitter cards on every page.
- Canonical URL set per page.
- `sitemap.xml` auto-generated from static routes + articles + docs.
- `robots.txt` allows all crawlers, points to sitemap.
- FAQPage JSON-LD on `/faq`.
- Product JSON-LD on `/pricing`.
- Article JSON-LD on every blog post.

## Deploying

The site is a standard Next.js 15 build. Recommended hosts:

- **Vercel** — connect the GitHub repo, set the project root to `website/`,
  add the four `NEXT_PUBLIC_LEMONSQUEEZY_*` env vars + `NEXT_PUBLIC_SITE_URL`.
- **Cloudflare Pages** — same setup, project root `website/`, build command
  `npm run build`, output `.next`.

## Project layout

```
website/
├── app/                Routes (page.tsx, layout.tsx, sitemap.ts, robots.ts)
│   ├── blog/[slug]/    Dynamic blog post detail
│   ├── docs/[slug]/    Dynamic doc page detail
│   ├── pricing/
│   ├── faq/
│   ├── changelog/
│   └── support/
├── components/         Reusable React components (Header, Footer, PricingCard, ...)
├── content/            All editable content (Markdown + JSON)
│   ├── articles/       Blog posts
│   ├── docs/           Documentation pages
│   ├── faq.json
│   ├── changelog.json
│   ├── pricing.json
│   └── site.json
├── lib/                Small utilities (content loader, SEO metadata helper, checkout resolver)
├── public/             Static assets (favicon, OG image)
├── CHANGELOG.md        Website release notes (separate from plugin)
└── README.md           This file
```

## License

See `LICENSE.txt` at the repository root.
