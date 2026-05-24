# v1.4.2-FINAL Google compliance audit

Every algorithm in this release maps to a Google-published source of
truth. If Google updates their guidance, revisit these specific points.

## Discovery / indexing

| Algorithm | OmniPlug behavior | Source |
|---|---|---|
| Sitemap URL cap | 50,000 per file (set in v1.4.1) | developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap |
| Sitemap size cap | 50 MB uncompressed | Same source |
| `<priority>` ignored | Omitted from output | Same source: "Google ignores `<priority>`" |
| `<changefreq>` ignored | Omitted from output | Same source |
| `<lastmod>` used by Google | Set from entity `updated_at` accurately | Same source: "Google uses the `<lastmod>` value if it's consistently and verifiably accurate" |
| robots.txt format | Plain text, UTF-8, served at root | RFC 9309 + Google docs |
| AI crawler whitelist | 13 user-agents incl. GPTBot, ClaudeBot, PerplexityBot, Google-Extended | Each engine's published UA |
| llms.txt format | Markdown per llmstxt.org spec | llmstxt.org |
| IndexNow protocol | Endpoint, key length, key file, throttle | indexnow.org/documentation |
| IndexNow Google support | Not supported (docs note this) | Google has been testing since 2021 without committing |

## Redirects

| Status | OmniPlug usage | Source |
|---|---|---|
| 301 | Default for slug rename (auto-created) | Google: "Permanent changes should always use 301 or 308" |
| 302 | Admin choice; temporary moves | Google: reserve for "truly temporary moves with planned end date" |
| 307 | Admin choice; temporary, preserve HTTP method | RFC 7231 |
| 308 | Admin choice; permanent, preserve HTTP method | RFC 7538; Google: "Google treats 308 similar to 301 for SEO" |
| 410 | Admin choice; permanently deleted | Google: accelerates de-indexing vs 404 |
| 451 | Admin choice; legal removal | RFC 7725 |
| Server-side only | All redirects are HTTP responses | Google: "Avoid client-side redirects... less reliable" |
| Loop guard | Max 3 hops via `X-Omniplug-Redirect-Count` | Google: "Excessive chains can trigger soft-404 handling" |

## Structured data (JSON-LD)

| Aspect | OmniPlug behavior | Source |
|---|---|---|
| Format | JSON-LD via `<script type="application/ld+json">` | Google: "Google recommends JSON-LD" |
| Vertical-aware types | RealEstateListing, MedicalBusiness, HealthAndBeautyBusiness, CreativeWork, Service | Schema.org + Google rich results docs |
| Article schema | BlogPosting with headline, image, datePublished, dateModified, author@Person, publisher@Organization | developers.google.com/search/docs/appearance/structured-data/article |
| Breadcrumb | BreadcrumbList | developers.google.com/search/docs/appearance/structured-data/breadcrumb |
| FAQ | FAQPage with Question/Answer pairs | developers.google.com/search/docs/appearance/structured-data/faqpage |
| Image URLs crawlable | Only public CDN URLs emitted | Google: "All image URLs specified in structured data must be crawlable and indexable" |
| Match visible content | All fields read from same data the public API serves | Google: "Structured data must be a true representation of the page content" |

## Image SEO

| Rule | OmniPlug enforcement | Source |
|---|---|---|
| Descriptive filenames | Suggestion algorithm rejects pure-hex, strips date/hash prefixes | developers.google.com/search/docs/appearance/google-images |
| Alt text required | Block-rule at publish time | Google: "the most important attribute when it comes to providing more metadata for an image is the alt text" |
| Alt max length | Cap at 125 chars (warn if exceeded) | Industry consensus from Google's effective display limit |
| Generic alt rejected | Never auto-apply suggestion; require admin review | Google: "Avoid generic alt text" |
| Decorative images alt="" | Admin sets manually; not auto-suggested | WCAG + Google accessibility guide |
| No keyword stuffing in alt | Suggestion never adds keywords beyond filename context | Google explicit |
| Image sitemap | Not implemented in v1.4.2-FINAL | Google announced 2023 deprecation; per their notice |
| Image dimensions | Width 1200×630 for OG; multi-aspect for Article schema | Google's Article rich result requirements |

## Snippet / meta tags

| Tag | OmniPlug output | Source |
|---|---|---|
| `<title>` | seo_title fallback to title, capped 70 chars | Google display cap ~580px desktop ≈ 60 chars |
| `<meta description>` | seo_description fallback to excerpt, capped 170 chars | Google snippet cap ~155 chars desktop |
| `<meta keywords>` | Rendered if present; not validated | Google ignores since 2009 (Matt Cutts statement) |
| `<link canonical>` | seo.canonical_url or self-reference | developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls |
| `<meta robots>` | Validated against whitelist incl. noai/noimageai | developers.google.com/search/docs/crawling-indexing/robots-meta-tag |
| `og:title` / `og:description` | Same fallbacks as title/description | ogp.me + Facebook Sharing Debugger |
| `og:image` 1200×630 | Default; respected from media row | Facebook + LinkedIn + Zalo conventions |
| `twitter:card` | summary_large_image if og image present, else summary | developer.twitter.com/cards |

## Soft-404 prevention

| Concern | OmniPlug response | Source |
|---|---|---|
| 404 returns 200 OK | Out of scope (application returns correct 404) | Google soft-404 docs |
| Redirect to homepage on missing | Use 410 for permanent removal instead | Google: "redirects to unrelated content trigger soft-404" |
| Thin content | Word count warn rule (<600 = flagged) | Google content quality docs |

## Things explicitly NOT implemented (with justification)

| Item | Why skipped |
|---|---|
| Meta keyword tag validation | Google ignores since 2009; Bing too |
| Exact keyword density (2-5%) as block | Google's John Mueller: "no magic density"; forced density = spam signal |
| Image file size 50KB hard cap | Modern WebP at 200-300KB is higher quality than 50KB JPEG; LCP/INP is the actual ranking signal |
| 805px fixed image width | Google recommends responsive `srcset`, not fixed width |
| External link DA score check | "Domain Authority" is a third-party Moz metric, not Google-exposed |
| Sentence-level grammar check | Out of scope; Google's content guidance is about meaning, not surface forms |
| News Sitemap | No target tenant publishes news |
| Video Sitemap | No target tenant has video catalogue |
| Google Search Console integration | OAuth + token rotation + cron worker overhead; defer until 2+ tenants ask |
| Email weekly SEO report | Depends on GSC integration above |
| Schema Templates UI for admins | Vertical-aware JSON-LD already covers the verticals; generic UI dilutes moat |
| Internal-linking suggestion engine | Over-engineering for 5-posts/month publishing cadence |
| Frontend SEO score widget | OmniPlug is headless; frontend rendering outside backend's render path |

## Practical operational rules

1. **Every algorithmic decision must have a Google source.** If a rule
   comes from a Vietnamese SEO consultant blog or a popular plugin's
   default behavior but contradicts current Google guidance, the rule
   either becomes a warn (not block) or is dropped.

2. **Block rules block publish. Warn rules don't.** Admins can publish
   with warnings; the SEO score reflects them. The publish gate exists
   to prevent shipping content that fails Google's required structured
   data + accessibility minimums.

3. **AI/LLM crawlers are first-class.** The robots.txt whitelists 13
   AI bots (in v1.4.1); the llms.txt file at root advertises content
   to LLM agents. As AI-powered search grows, this matters more.

4. **Vietnamese diacritics are preserved everywhere.** Slug normalization
   is the only place we strip diacritics (Google's URL recommendation).
   All other text processing — alt text, title, description, keyword
   matching — preserves Vietnamese characters fully.

5. **Backward compatibility is non-negotiable.** All new columns are
   nullable with defaults. All new tables are referenced only by new
   modules. v1.4.1 contracts (sitemap, robots, llms, feed, JSON-LD
   endpoints) are unchanged.
