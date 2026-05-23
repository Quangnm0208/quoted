# Citation Tracking Algorithm — Spec (Phase 2, Month 5–6)

**Status:** SPEC ONLY. Do NOT build in Phase 0. This document exists so the
Phase 0 schema design accommodates Phase 2 without rework.

**Why this is the hardest feature in Quoted:**

Bot crawls are trivial (user-agent string match). Citations are hard because:

1. No AI provider has a "citations dashboard API" — you must poll
2. Polling is expensive ($)
3. Domain matching has many edge cases (subdomain, mobile URL, AMP, redirects)
4. False positives kill trust; false negatives kill perceived value
5. AI responses are non-deterministic (same query → different cites tomorrow)

This is also the **#1 retention moat**. Get this right, no one can copy you
without paying the same $X/month per user in API costs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Citation Polling Pipeline (cron, Pro tier only)                 │
│                                                                 │
│   1. PROMPT GENERATOR                                           │
│      • Pull tenant's top categories + topics                    │
│      • Match category to niche prompt template library          │
│      • Generate 10 prompts/week (Pro) or 20 (Agency)            │
│                                                                 │
│   2. PROVIDER FANOUT                                            │
│      ┌───────────┐  ┌──────────┐  ┌──────────┐                 │
│      │Perplexity │  │Tavily    │  │Serper    │                 │
│      │Sonar API  │  │API (fb)  │  │API (fb)  │                 │
│      └─────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│            │             │             │                        │
│            └─────────────┼─────────────┘                        │
│                          ▼                                      │
│   3. DOMAIN MATCHER                                             │
│      • Parse response → extract all linked URLs                 │
│      • Match against tenant's domain (exact + 3 variants)       │
│      • Score confidence 0.0–1.0                                 │
│                                                                 │
│   4. DEDUPLICATION                                              │
│      • Hash (provider + query + cited_url) → 7-day dedup window │
│      • Same citation in 2 providers = boost confidence          │
│                                                                 │
│   5. PERSISTENCE                                                │
│      • Write to citations table with confidence                 │
│      • Trigger notification if confidence ≥ 0.85                │
│                                                                 │
│   6. USER PRESENTATION                                          │
│      • Dashboard shows verified ≥ 0.85                          │
│      • "Likely" tab shows 0.65–0.85                             │
│      • Hide < 0.65                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Prompt generation

The hardest part is generating prompts that **realistic users would ask**
about the site's niche. Don't generate prompts that mention the site directly
(circular). Generate prompts a user *unaware of the site* might ask.

### Strategy: Template library × tenant inputs

For each niche, maintain a library of 30–50 prompt templates. Sample 10/week
per tenant, varied across templates.

**Example templates (niche: "outdoor gear"):**

```
"What are the best {product_category} for {use_case} in {year}?"
"Recommend a {product_category} under ${budget}"
"Compare {brand_A} vs {brand_B} {product_category}"
"Is {brand_X} {product_category} worth it for {persona}?"
"Top {N} {product_category} reviewed by experts"
```

**Tenant inputs (extracted from their content):**

```js
{
  niche: 'outdoor-gear',
  product_categories: ['running shoes', 'hiking boots', 'trail runners'],
  use_cases: ['marathon training', 'ultra running', 'thru-hiking'],
  brands_covered: ['Hoka', 'Brooks', 'Salomon', 'Altra'],
  price_range: { min: 100, max: 300 },
  year: 2026
}
```

Generation: Cartesian product, filter for sensibility, sample 10.

**Critical:** Prompts must NOT contain the tenant's domain or brand name.
That defeats the test (we want to know if AI cites them WITHOUT prompting).

### Niche detection

How do we know a tenant's niche? Two paths:

1. **Manual:** Onboarding step asks "What does your site write about?"
   with a dropdown of 40 predefined niches. (8-click flow includes this.)

2. **Auto:** Run their top 20 post titles through Claude with a classifier
   prompt → niche label. Confirm with user.

Build manual first. Auto as Phase 3 upgrade.

### Niche library v1 (40 niches)

```
outdoor-gear, fitness-equipment, supplements, cooking, kitchen-gadgets,
travel, hotels, flights, parenting, baby-gear, finance-personal,
investing, crypto, real-estate, mortgages, software-saas, productivity-tools,
ai-tools, marketing, seo, web-dev, gardening, home-improvement, smart-home,
pets, dog-training, cat-care, automotive, ev-cars, motorcycles,
photography, video-gear, music-production, podcasting, gaming,
boardgames, books-reviews, education-online-courses, language-learning,
wellness-mental-health
```

Each niche has its own template file: `niches/outdoor-gear.prompts.json`.

---

## 2. Provider fanout

### Primary: Perplexity Sonar API

```http
POST https://api.perplexity.ai/chat/completions
Authorization: Bearer <key>

{
  "model": "sonar-pro",
  "messages": [{ "role": "user", "content": "<prompt>" }],
  "return_citations": true,
  "search_recency_filter": "month"
}
```

Response includes `citations` array with URLs. **This is the gold standard
because Perplexity returns explicit citation URLs.**

**Cost:** ~$5/M input tokens. Avg query: ~1K input + 1K output = ~$0.01/query.
- Pro user: 10 queries × $0.01 = $0.10/week = **$0.40/month**
- Agency user (30 sites): 20 queries × 30 sites × $0.01 = $6/week = **$24/month**

### Fallback: Tavily API or Serper API

If Perplexity rate-limits or returns degraded results, fall back to:
- **Tavily** (`api.tavily.com/search`) — built for AI, returns clean results
- **Serper** (`google.serper.dev`) — Google SERP scrape, cheap

These don't simulate AI citation behavior directly, but verify domain
mention in top results — proxy signal.

### Provider rotation logic

```js
async function queryProviders(prompt) {
  const results = [];
  try {
    const pplx = await perplexity.query(prompt);
    results.push({ provider: 'perplexity', ...pplx });
  } catch (err) {
    logErr('perplexity_failed', err);
  }

  // Always also query Tavily for cross-validation
  try {
    const tav = await tavily.search(prompt);
    results.push({ provider: 'tavily', ...tav });
  } catch (err) {
    logErr('tavily_failed', err);
  }

  return results;
}
```

If both providers cite the same URL → confidence boost.

---

## 3. Domain matching

This is where false positives/negatives happen. Be paranoid.

### Build a domain set per tenant

For domain `marcus-outdoor.com`, accept all of:

```js
const accepted = new Set([
  'marcus-outdoor.com',
  'www.marcus-outdoor.com',
  'm.marcus-outdoor.com',
  'amp.marcus-outdoor.com',
  // Custom subdomains user declared in settings:
  'blog.marcus-outdoor.com',
  'shop.marcus-outdoor.com',
]);
```

### Matching logic

```js
function isCitation(citedUrl, acceptedDomains) {
  try {
    const u = new URL(citedUrl);
    const host = u.hostname.toLowerCase();

    // Exact match
    if (acceptedDomains.has(host)) return { match: true, confidence: 1.0 };

    // Subdomain of accepted (e.g., random.marcus-outdoor.com)
    for (const accepted of acceptedDomains) {
      if (host.endsWith('.' + accepted)) {
        return { match: true, confidence: 0.9 };
      }
    }

    // Lookalike: punycode, typos, near-matches — REJECT
    // Don't claim "marcus-outdoors.com" cites for "marcus-outdoor.com"
    return { match: false, confidence: 0 };
  } catch {
    return { match: false, confidence: 0 };
  }
}
```

### URL canonicalization

The cited URL might be `https://marcus-outdoor.com/best-shoes/?utm=ai` but
the canonical post is `/best-shoes`. Normalize:

```js
function canonicalizeUrl(url) {
  const u = new URL(url);
  // Strip tracking params
  ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'ref']
    .forEach(p => u.searchParams.delete(p));
  // Strip trailing slash
  let path = u.pathname.replace(/\/$/, '') || '/';
  // Lowercase host
  return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
}
```

### Match to post slug

Once URL matches domain, extract slug and look up in posts table:

```js
function urlToSlug(url) {
  const u = new URL(url);
  const segments = u.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || null; // last segment
}
```

If slug found in `articles` table for tenant → cited_article_id populated.
If not → still a domain citation, but no specific post (still count it).

---

## 4. Confidence scoring

Confidence in [0, 1]:

| Signal | Weight |
|---|---|
| Exact domain match | +0.5 |
| Subdomain match | +0.3 |
| Same URL in 2+ providers | +0.3 |
| URL appears in Perplexity `citations` array (not just response text) | +0.2 |
| Slug matches existing post | +0.1 |
| Cited domain is in expected niche | +0.05 |
| URL appears with positive context (reviewed, recommended, …) | +0.05 |
| URL appears with negative context (avoid, scam) | -0.3 |

**Thresholds:**
- ≥ 0.85: "Verified citation" — show prominently, trigger notification
- 0.65–0.85: "Likely citation" — show in dedicated tab
- < 0.65: Hide entirely

Tune thresholds with real data after Month 5.

---

## 5. Deduplication

Same query polled weekly. AI responses change. We want:
- New citation appears → notify user
- Same citation re-appears next week → don't re-notify
- Citation disappears for 3 weeks → mark as "lost", notify (loss frame is engaging)

```js
const dedupKey = sha256(`${provider}:${normalize(query)}:${canonicalUrl}`);

// 7-day window:
// If dedupKey seen in last 7 days, this is a re-confirmation, not a new citation.
// Update last_seen_at but don't notify.

const existing = await citations.findByDedup(tenantId, dedupKey, '7 days');
if (existing) {
  await citations.touch(existing.id);
  return { action: 'reconfirmed', citation: existing };
} else {
  const created = await citations.create({ tenantId, dedupKey, ...data });
  await notifications.queue('citation_new', tenantId, created.id);
  return { action: 'new', citation: created };
}
```

---

## 6. Loss detection

Run weekly: for each citation last seen >21 days ago and not seen this week,
mark as `status='lost'`.

```sql
UPDATE citations
SET status = 'lost', lost_at = datetime('now')
WHERE tenant_id = ?
  AND last_seen_at < datetime('now', '-21 days')
  AND status = 'active';
```

Lost citations get a soft notification: "You used to be cited for 'X', but
Claude stopped citing you this month. Want to know why?" → leads to content
optimization suggestion. **High retention signal — loss aversion engagement.**

---

## 7. Cron schedule

```
Free tier:    Never poll (only crawl logs)
Pro tier:     Sunday 11PM UTC, batched per tenant time zone
Agency tier:  Tuesday 11PM + Sunday 11PM
```

Stagger by tenant_id % 24 to spread API rate limits across 24 hours of Sunday.

```js
const hour = tenantId % 24; // 0-23
// Schedule this tenant to poll on Sunday at <hour>:00 UTC
```

---

## 8. Failure modes + handling

| Failure | Detection | Recovery |
|---|---|---|
| Perplexity API down | HTTP 5xx | Fall back to Tavily-only this week, log incident, notify operator if 3 weeks |
| Rate limit hit | HTTP 429 | Exponential backoff, queue for next slot |
| Provider returns 0 citations all week | No data | Don't show 0 to user; show "Polling continues" instead |
| Provider returns hallucinated URLs | URLs that don't resolve | HEAD-check URL before accepting as citation |
| Domain hijacked (user warns us) | Manual flag | Pause polling, alert operator |
| Tenant's content removed | 404 on cached URL | Don't fail polling; just mark citation as "broken link" |

---

## 9. Cost model at scale

Assume target state Month 12: 300 Pro + 50 Agency.

| Tier | Users | Queries/week/user | $/query | Weekly cost | Monthly cost |
|---|---|---|---|---|---|
| Pro | 300 | 10 | $0.012 (pplx + tavily) | $36 | $144 |
| Agency | 50 (avg 15 sites) | 20 × 15 = 300 | $0.012 | $180 | $720 |
| **Total** | | | | **$216/week** | **~$864/month** |

Revenue at same scale: 300 × $19 + 50 × $99 = $10,650/month.
Citation polling = ~8% of revenue. Acceptable margin.

---

## 10. Schema (already in Phase 0 migration)

```sql
CREATE TABLE citations (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  source TEXT NOT NULL,           -- 'perplexity' | 'tavily' | 'serper' | 'user_submitted'
  query TEXT NOT NULL,
  cited_url TEXT NOT NULL,
  cited_url_canonical TEXT NOT NULL,
  cited_article_id INTEGER,       -- nullable; FK to articles when slug matches
  response_excerpt TEXT,
  confidence REAL NOT NULL,
  dedup_key TEXT NOT NULL,
  status TEXT DEFAULT 'active',   -- 'active' | 'lost'
  first_seen_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  lost_at DATETIME,
  verified BOOLEAN DEFAULT 0,
  UNIQUE(tenant_id, dedup_key)
);
CREATE INDEX idx_citations_tenant_status ON citations(tenant_id, status, last_seen_at DESC);
```

---

## 11. Open questions (resolve before Phase 2 starts)

1. **GoogleExtended user-agent**: Google AI Overviews uses different signals.
   Should we add direct SERP scraping for "AI Overview cited" detection?
   → Test in Phase 1, decide.

2. **ChatGPT Search citations**: OpenAI doesn't expose an API. Workaround:
   browser automation via Playwright? Costly. Skip for v1.

3. **Claude in Chrome**: Anthropic's browsing agent. Cite tracking unclear.
   → Reach out to Anthropic devrel before Phase 2.

4. **User-submitted citations**: UI for paste link → AI verify → log. Easy,
   high-trust, but manual. Worth building?
   → Yes. Cheap to build, gives 100%-confidence citations users brag about.

---

## Build order when Phase 2 starts (Month 5)

```
Week 1: Niche template library (10 niches first, not all 40)
Week 2: Perplexity client + domain matcher
Week 3: Confidence scoring + dedup + persistence
Week 4: Tavily fallback + cron scheduler
Week 5: User-submitted citations UI
Week 6: Loss detection + notifications + dashboard tab
```

By end of Month 6, you have citations as the killer Pro tier differentiator.

---

## Final note

**Don't over-engineer this in Phase 0.** Many founders try to build the full
citation pipeline upfront because "it's the moat." That's a trap.

In Phase 0 you only need: schema design that won't break later (covered in
`migrations/024_citations.sql`), and a stub `citations.controller.js` that
returns empty for the dashboard query.

When Phase 2 begins, this spec is the blueprint. Until then, ship Phase 0
and earn the right to spend $864/month on API calls.
