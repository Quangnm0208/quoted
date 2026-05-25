# 03 — Front-end → CMS Contract

> **Canonical doc:** [`CMS-FRONTEND-INTEGRATION.md`](./CMS-FRONTEND-INTEGRATION.md) section "Architecture" + [`API-CONTRACT.md`](./API-CONTRACT.md) for full request/response schemas.

## Page → section → endpoint mapping (v0.5.0)

| Page | Section | CMS Key | Required Fields | API Endpoint | Status |
|---|---|---|---|---|---|
| Home | Hero | `quoted_home` / `hero` | subtitle, payload.eyebrow, payload.cta_primary_*, payload.cta_secondary_* | `GET /api/public/pages/quoted_home` | ✅ live |
| Home | Programs header | `quoted_home` / `programs` | title, subtitle, payload.eyebrow | same response | ✅ live |
| Home | Promo cards | `quoted_home` / `programs` → `payload.items[0..5]` | pill, title, body, code, cta_label, cta_url, meta, is_feature | same response | ✅ live |
| Home | The shift demo | n/a | — | — | ⏳ M3 static |
| Home | How it works | n/a | — | — | ⏳ M3 static |
| Home | Live demo | n/a | — | — | ⏳ M3 static |
| Home | Product features | n/a | — | — | ⏳ M3 static |
| Home | Compat tabs | n/a | — | — | ⏳ M3 static |
| Home | Use cases | n/a | — | — | ⏳ M3 static |
| Home | Pricing cards | n/a (will use `/api/products/plans`) | — | `GET /api/products/plans` (exists; not wired) | ⏳ M3 |
| Home | Testimonials | n/a | — | — | ⏳ M3 static |
| Home | FAQ | n/a | — | — | ⏳ M3 static |
| Home | Final CTA | n/a | — | — | ⏳ M3 static |
| `/pricing` | All sections | n/a | — | — | ⏳ M3 static |
| `/faq` | All sections | n/a | — | — | ⏳ M3 static |
| `/docs` | Article index | n/a (will use `/api/public/articles`) | — | `GET /api/public/articles` (exists) | ⏳ M4 |
| `/blog` | Post index | n/a | — | `GET /api/public/articles` | ⏳ M4 |
| `/changelog` | Release entries | n/a | — | — | ⏳ M4 |
| `/success` | Post-checkout | n/a | — | reads query params from LS redirect | ✅ |
| Header | Logo / nav | n/a (will use `/api/public/site`) | — | — | ⏳ M5 |
| Footer | Contact / social | n/a (will use `/api/public/site`) | — | — | ⏳ M5 |

## Standard public-section response (today's actual shape)

```json
{
  "page": "quoted_home",
  "sections": [
    {
      "key": "hero",
      "type": "hero_banner",
      "title": "When customers ask AI, be in the answer.",
      "subtitle": "Quoted is a small WordPress plugin...",
      "payload": {
        "eyebrow": "New · live on WordPress.org",
        "cta_primary_label": "Install free plugin",
        "cta_primary_url": "https://wordpress.org/plugins/quoted/",
        "cta_secondary_label": "See it in action",
        "cta_secondary_url": "#live-demo"
      }
    },
    {
      "key": "programs",
      "type": "rich_text",
      "title": "Ways to pay less. Sometimes nothing at all.",
      "subtitle": "Discounts and partnerships we actually mean.",
      "payload": {
        "eyebrow": "Programs",
        "items": [ { "pill": "...", "title": "...", "body": "...", "code": "...", "cta_label": "...", "cta_url": "...", "meta": "...", "is_feature": true }, ... ]
      }
    }
  ]
}
```

> The master-prompt's canonical envelope `{success, data, error, meta}` is NOT what this endpoint returns. OmniPlug uses a flatter shape inherited from upstream. The `cms.js` hydrator is written for the actual shape. If we want envelopes, would need a wrapper middleware — none of the consumers (front-end + SDK) need it, so deferred.

## Cache rule

`Cache-Control: public, max-age=60, stale-while-revalidate=300` on the public sections endpoint (set in `pages.controller.js` line 52). Edge can serve >95% of marketing traffic without hitting the API.

## Error rule (verified in T-CMS-FE-4)

| Condition | Server returns | Client behaviour |
|---|---|---|
| Unknown `pageKey` | 200 + `{page, sections: []}` | hydrator: no patches → static HTML stays |
| API unreachable / 5xx / CORS block | n/a | hydrator: timeout 5s → catch → dev console warn → static HTML stays |
| Empty payload field | section returned but field null | hydrator: `pickField` returns null → `applyTextContent` no-op → static stays |
| Bad JSON in payload | 500 from API | hydrator: catch → static stays; admin save would have rejected client-side |

## API namespace rules (enforced)

| Namespace | Auth | Used by | Tested by |
|---|---|---|---|
| `/api/health` | none | uptime monitors | npm test (smoke) |
| `/api/public/*` | none, Host-based tenant | marketing site | T-CMS-FE-1..6 |
| `/api/admin/*` | JWT (admin/editor) | CMS UI | OmniPlug smoke 18, M2 manual verify |
| `/api/v1/*` | API key + license | SDK + WP plugin (gated) | quoted-test-* commercial |
| `/api/payments/*` | varies (checkout: none; webhook: HMAC) | front-end + LS | T-PAY-1..9 |
| `/api/payments/webhook/*` | raw body + HMAC | LS only | T-PAY-4..9 |
