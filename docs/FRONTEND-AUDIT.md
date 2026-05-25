# Front-end Audit — Quoted marketing site (`frontend/`)

**Audited:** 2026-05-24 against `frontend/` at commit `0cb96a3`.
**Author:** Integration pass — read-only static site, no build step.

This audit catalogues every broken interaction, missing piece, and architectural
concern found during the integration. Items marked **[FIXED]** were resolved
in the follow-up commit; items marked **[PENDING]** need a business decision
or external dependency and stayed open.

---

## TL;DR

The site looks polished — hero 3D, dark mode, promo bar, 6 pages — but a lot of
the interactive surface is theater (newsletter forms don't store anything, the
sidebar nav doesn't navigate, CTAs go to `#`). And the most glaring miss is that
**a site selling "make your WordPress site AI-readable" doesn't have its own
`llms.txt`, `robots.txt`, `sitemap.xml`, or structured data.**

---

## P0 — Broken interactions

| # | Issue | Where | Status |
|---|---|---|---|
| 1 | Docs sidebar has 10 link entries; none of the target IDs exist in the page. Only `#what-you-get`, `#requirements`, `#install`, `#verify`, `#next-steps` are real. | `docs.html:160-179` | **[FIXED]** Sidebar now matches the article's real H2 structure. The 5 future sections were moved to a "More guides coming" footer. |
| 2 | Docs search input has no JavaScript handler. Promises `⌘K` shortcut, delivers nothing. | `docs.html:150` | **[FIXED]** Replaced placeholder with a real anchor-only filter (in-page jump-to-section). `⌘K` chip removed because the global palette isn't real yet — adding it would be a new feature. |
| 3 | All 10 blog post cards link to `#post-X` anchors that don't exist on the page. No post detail pages exist. | `blog.html:225-310` | **[FIXED]** Cards converted from `<a>` to `<article>` with a visible "Coming soon" chip. No more dead clicks. Newsletter signup is the only call-to-action until posts exist. |
| 4 | Pricing/home CTA "Start Starter" / "Start Pro" all `href="#"` (6 instances). | `pricing.html:306,329,387,392`, `index.html:1626,1649` | **[FIXED]** Repointed to `https://wordpress.org/plugins/quoted/` — matches the documented flow ("install Free, upgrade from inside the plugin", per FAQ.html:222). When Lemon Squeezy URLs are real, swap one constant in `assets/shared.js`. |
| 5 | Three newsletter forms (blog, changelog, welcome popup) preventDefault and write `localStorage.setItem('subscribed','1')` — no email is captured. Visitor thinks they subscribed. | `blog.html:326`, `changelog.html:212`, `assets/shared.js:518` | **[PENDING]** Needs a real list backend (ESP) or wire to `/api/public/leads` on OmniPlug. Risk: GDPR — collecting an email field without a processing target is a data-protection grey zone. The visible UI now states "Mailing list opens with Phase 1" to remove the implied promise. |
| 6 | Promo bar claims "17/100 claimed" hardcoded — never changes. | `assets/shared.js:32` `claimed: 17` | **[PENDING]** Static placeholder; needs a real counter backed by `/api/public/site` (the OmniPlug site config endpoint already exists). For now the counter is annotated in code as `// STATIC PLACEHOLDER — wire to backend before launch`. |
| 7 | 6 other `href="#"` placeholders: docs breadcrumb (×2), docs "Previous" nav, changelog RSS button, 2 hero demo "Source:" links. | `docs.html:185,242`, `changelog.html:116`, `index.html:1056,1234` | **[FIXED]** Breadcrumb is now plain text (one doc article only). Doc nav block removed (only 1 article exists). RSS button now points to the new `/rss.xml`. Hero demo source links are now `<code>` (non-clickable, since they're stylised examples not real targets). |

---

## P0 — Dog-fooding gap (Quoted didn't follow its own pitch)

Quoted sells: "auto-generated `/llms.txt`, clean Markdown endpoints, JSON-LD schema, robots.txt sync, AI bot allowlist". The marketing site shipped without any of those for itself.

| Item | Status | Notes |
|---|---|---|
| `frontend/llms.txt` | **[FIXED]** | New file, 6-line AI-readable index of all pages. |
| `frontend/robots.txt` | **[FIXED]** | New file. Allow-by-default + named allow rules for ClaudeBot/GPTBot/PerplexityBot/GoogleExtended + sitemap pointer. |
| `frontend/sitemap.xml` | **[FIXED]** | New file. Lists all 6 pages with `<lastmod>`. |
| `frontend/rss.xml` | **[FIXED]** | New file. Mirrors the changelog so the RSS button is no longer dead. |
| `frontend/404.html` | **[FIXED]** | Branded "Page not found" with link home. |
| `<link rel="canonical">` per page | **[FIXED]** | All 6 pages. Prevents `index.html#pricing` vs `pricing.html` duplicate-content issues. |
| Open Graph + Twitter Card meta | **[FIXED]** | `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description` on all 6 pages. `og:image` points at a new `/assets/og-default.svg`. |
| `<meta name="theme-color">` | **[FIXED]** | Set to `#3b3fbf` (light) + `#0f1014` (dark) via media query. |
| JSON-LD on FAQ | **[FIXED]** | `FAQPage` schema generated from the existing `<details>` content. |
| JSON-LD on Pricing | **[FIXED]** | `SoftwareApplication` + 3 nested `Offer` blocks (Free/Starter/Pro). |
| JSON-LD on Home + sitewide | **[FIXED]** | `Organization` + `WebSite` (with `SearchAction` pointing at FAQ search) emitted by `shared.js`. |
| JSON-LD on Blog | **[FIXED]** | `Blog` + `BlogPosting` entries derived from the post-card list. |
| JSON-LD on Changelog | **[FIXED]** | `SoftwareApplication` + per-version `SoftwareSourceCode` references. |
| JSON-LD on Docs | **[FIXED]** | `TechArticle` for the single "Getting started" page. |

---

## P1 — Information architecture

| Issue | Status | Notes |
|---|---|---|
| Blog has 10 cards but 0 actual posts. | **[FIXED for now]** | Cards now declare "Coming soon" so visitors don't expect content. When real posts ship, swap `<article>` back to `<a href="blog/<slug>.html">`. |
| Docs has 1 article + 10 sidebar promises (now 5 → matches real H2s + "More guides coming"). | **[FIXED for now]** | Sidebar trimmed to real anchors. Add new entries as new articles ship. |
| Changelog only has v0.1.0 + v0.2.0 entries; repo `CHANGELOG.md` is newer. | **[PENDING]** | Needs a content sync. The repo CHANGELOG.md tracks v0.3.0+ but the marketing changelog doesn't. Either hand-port or add a build step that copies. |
| Marketing pricing ("Starter $19", "Pro $29") doesn't match backend plan vocabulary (`free`, `pro`, `agency`). | **[PENDING]** | Cross-cutting decision. We map at the boundary in `wp-sites.service.js:mapPlan()` but the website still says "Starter $19" while the backend has no such plan. Needs alignment before public launch. |

---

## P1 — Accessibility (a11y)

| Issue | Status |
|---|---|
| No skip-to-content link. | **[FIXED]** Added `.skip-link` on every page; styled in `shared.css`. |
| No `<main>` landmark. | **[FIXED]** Each page now wraps its content in `<main id="main">…</main>`. |
| `:focus-visible` style appears once in `shared.css`. | **[FIXED]** Global `:focus-visible` style added — 2px solid `var(--q-primary)` outline + offset. |
| Mobile-nav toggle missing `aria-expanded` / `aria-controls`. | **[FIXED]** `aria-expanded` now toggles on click. |
| Welcome popup is `role="dialog"` without `aria-modal`, focus trap, or focus-restore. | **[FIXED]** `aria-modal="true"`, focus-trap loop on Tab/Shift+Tab, focus returns to the element that opened the dialog on close. |
| `prefers-reduced-motion` honoured only by the hero (1 chỗ). | **[FIXED]** Sitewide reduce-motion rule in `shared.css`: animations capped at `0.01ms`, scroll-behavior reverted to `auto`. |
| `localStorage` reads/writes are unguarded — Safari private mode + iOS quota throws break the page. | **[FIXED]** All access goes through `safeStorageGet` / `safeStorageSet` in `shared.js` with try/catch. |
| `<html lang="en">` everywhere; README mentions Vietnamese strings. | **[PENDING]** Single decision: is the marketing site English-only forever, or are we adding `vi.html` siblings + `hreflang`? Leaving `lang="en"` until decided. |

---

## P1 — Performance

| Issue | Status |
|---|---|
| Google Fonts `@import` inside `shared.css` — worst-case load order (blocks CSS parse, blocks render). | **[FIXED]** Removed `@import`; added `<link rel="preconnect">` + `<link rel="stylesheet">` in each HTML head, before `assets/shared.css`. |
| Hero 3D `requestAnimationFrame` runs even when hero is off-screen. | **[FIXED]** Wrapped in `IntersectionObserver` — rAF only ticks while the stage is visible. |
| No `loading="lazy"` on below-the-fold images. | **N/A** site uses zero `<img>` tags — only inline SVG. |

---

## P1 — Security

| Issue | Status |
|---|---|
| Two `window.parent.postMessage(..., '*')` calls in `shared.js` (designer-tool edit-mode protocol). | **[FIXED]** Receive-side now requires `e.source === window.parent` — only the direct parent frame is honored, no cross-frame poisoning. Send-side keeps `'*'` (we send no secrets, only a "ready" beacon). |
| No CSP meta tag. | **[PENDING]** Should be set by the static-host config (Cloudflare Pages / Vercel headers) rather than in HTML, since `<meta http-equiv="CSP">` doesn't support `frame-ancestors`. Documented for the deploy step. |
| `navigator.clipboard?.writeText` has no fallback when denied. | **[FIXED]** If the promise rejects or the API is missing, the button shows the code as selectable text so the visitor can `⌘C`. |

---

## ⚙️ Architecture / CTO-level — all **[PENDING]**

These are decisions, not bugs. None were touched in the fix pass.

1. **Content layer.** README says "point your headless CMS templates at the same DOM structure" but there's no template, no Astro/11ty/MDX, no markdown source. Every edit is hand-HTML. Decide: keep static + hand-edited, or move to 11ty/Astro pulling from `/api/public/articles` (already exposed by the backend).
2. **Tweaks Panel ships to end-users.** Accent/theme/density/tilt customisation is exposed to visitors. They can change accent to "Amber" and screenshot it — off-brand. Should be dev-only (`?tweaks=1` URL flag) or moved into the WP plugin admin.
3. **Site dog-fooding mismatch.** Marketing uses "Starter $19 / Pro $29" USD. Backend uses `free / pro / agency`. WP plugin uses `qtd_live_*` + Lemon Squeezy. Three layers, three vocabularies. Pick one source of truth.
4. **Zero analytics, zero error reporting.** Plausible/Umami/PostHog/Sentry — pick one before public launch.
5. **`quotedeasy.com` hardcoded in 26 places.** Centralise into a `shared.js` constant or a build-time replace.
6. **Lemon Squeezy checkout not wired.** "Start Pro" currently lands on the WordPress.org install page (matches the documented flow), but a direct Pro checkout path will need the LS store ID + product variant.
7. **Frontend deploy story undecided.** Standalone static (Cloudflare Pages / Vercel) or served by OmniPlug at `/web`? Affects CSP, cache headers, and the canonical URL strategy.
8. **Promo bar / pricing should pull from `/api/public/site`.** Backend already exposes a config endpoint. Currently hardcoded in `shared.js`.
9. **Brand "v1.0 Indigo"** vs the tokens.css live-swappable accents — pick one source of truth for the design system.

---

## ✅ Things working well (don't touch)

- Token-based design system (`tokens.css`), dark mode, accent swap.
- Shared chrome injection via `data-include="header"` — DRY with no build step.
- Modern CSS (`color-mix`, `backdrop-filter`, `mask-image`).
- `<details>` for FAQ (native, no-JS fallback).
- FAQ search + blog tag filter — both wired correctly.
- Mobile nav, billing toggle, Shift demo, hero 3D — all wired.
- Zero npm runtime deps for the front-end.
