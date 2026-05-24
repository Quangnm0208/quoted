# Quoted — Static website prototype

Clean, framework-free HTML/CSS/JS implementation of the Quoted marketing site.
All pages are standalone and link to each other relatively, so the bundle
works on any static host, a CDN, or the file:// protocol.

## Pages

| File              | Purpose                                                  |
|-------------------|----------------------------------------------------------|
| `index.html`      | Home — hero 3D, live llms.txt demo, Shift toggle, pricing, programs, FAQ |
| `pricing.html`    | Pricing — 3 plans, monthly/yearly toggle, diff matrix    |
| `docs.html`       | Docs — sidebar nav, article, right TOC                   |
| `changelog.html`  | Changelog — timeline with versioned entries              |
| `blog.html`       | Blog — featured + 9-post grid + tag filters              |
| `faq.html`        | FAQ — 5 categories, sticky sidebar, live search          |

## Assets

`assets/` contains:
- `shared.css` — design tokens (light + dark), shared chrome styles, components
- `shared.js` — injects `<header>` + `<footer>` + promo bar + welcome popup + tweaks panel
- `hero.js` — cursor parallax + idle float for the home hero 3D cards
- `tokens.css` — brand v1.0 CSS custom properties (Indigo `#3b3fbf`)
- `logo-mark.svg`, `logo-lockup.svg`, `logo-lockup-dark.svg`, `favicon.svg`

## How to integrate with a headless CMS

The current build is **static HTML**. Content that should later be
CMS-driven is identifiable from these landmarks:

- **Pricing** — `#pricing` section on `index.html` and full `pricing.html`.
  Each plan card has a stable structure: name + tag + price + cta + feature list.
- **FAQ** — `#faq` on `index.html` and full `faq.html` (`.qa details`).
- **Programs / promotions** — `#programs` on `index.html` (`.programs-grid > .program`).
- **Use cases** — `#use-cases` on `index.html` (`.use-cases-grid > .uc`).
- **Blog posts** — `blog.html` (`.featured` + `#post-grid > .post-card`).
- **Changelog entries** — `changelog.html` (`#feed-side ul` + `.entry`).
- **Docs articles** — `docs.html` (`.docs-sidebar` + `.doc` body).
- **Top promo bar + welcome popup config** — `assets/shared.js` (`SITE.promo` block).
- **Header + footer links** — `assets/shared.js` (`SITE.nav` + `SITE.footer`).

Each card / entry / link is plain HTML — point your headless CMS templates at
the same DOM structure and your edits will render unchanged.

## Live URL referenced

The header status pill + footer brand block link to `https://quotedeasy.com`
(set in `assets/shared.js > SITE.url`).

## Browser support

Modern evergreen browsers. Uses CSS `color-mix`, `backdrop-filter`,
`mask-image`, and IntersectionObserver. No build step, no bundler.

---

Brand: Quoted v1.0 · Indigo (`#3b3fbf`) primary, Inter sans, JetBrains Mono.
