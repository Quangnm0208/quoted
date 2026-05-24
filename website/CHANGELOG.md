# Quoted Website — Changelog

All notable changes to the marketing/sales website (separate from the
WordPress plugin itself).

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-05-24

### Added

- Initial site scaffold: Next.js 15 (App Router), React 19, TypeScript,
  Tailwind v4, MDX content.
- Pages: `/`, `/pricing`, `/docs`, `/docs/[slug]`, `/blog`, `/blog/[slug]`,
  `/faq`, `/changelog`, `/support`.
- Components: Header, Footer, CtaButton, FeatureCard, FaqItem, PricingCard,
  PricingGrid (monthly/yearly toggle), ChangelogItem, BlogCard, DocLayout.
- Content layer (file-based, no database):
  - `content/site.json` — name, nav, footer, social, support email.
  - `content/pricing.json` — Free / Starter / Pro plans, features, CTA env mapping.
  - `content/faq.json` — 12 buyer-objection FAQs.
  - `content/changelog.json` — plugin release notes mirrored from plugin CHANGELOG.
  - `content/articles/` — 2 seed SEO blog articles.
  - `content/docs/` — 9 documentation pages (Getting Started, Installation,
    Plugin Setup, FAQ Setup, Documentation Setup, Changelog Setup, SEO
    Content Workflow, Troubleshooting, Billing & License, Support).
- Lemon Squeezy integration via 4 public env vars; graceful disabled state
  if env vars are missing.
- SEO infrastructure:
  - Unique metadata per page (title, description, OG, Twitter, canonical).
  - Auto-generated `sitemap.xml` covering static + dynamic routes.
  - `robots.txt` allowing all crawlers, pointing to sitemap.
  - FAQPage JSON-LD on `/faq`.
  - Product JSON-LD on `/pricing`.
  - Article JSON-LD on every `/blog/[slug]`.
- Mobile-responsive layouts using Tailwind v4.
- README explains owner workflow for editing articles, FAQ, docs,
  changelog, pricing links, and product copy without React knowledge.
