-- =====================================================================
-- Migration 039: enrich the `programs` section payload with 6 promotion
-- cards so each card is CMS-editable.
--
-- Companion to 038 (which seeded just the section header). The 6 cards
-- are the Quoted launch promotions:
--   1. Early bird — 30% off Pro for first 100 agencies, code EARLYBIRD30
--   2. 30-day money-back guarantee
--   3. Switch & save — covers first 3 months for SEO-plugin migrators
--   4. Agency partner program — 25% recurring
--   5. Non-profit & edu — 50% off for .edu / 501(c)
--   6. Refer a friend — 1 month free per signup
--
-- Each item has: { pill, title, body, code, cta_label, cta_url, meta,
--                  is_feature }
-- `code` is the copy-able promo code (only Early bird uses it today).
-- `is_feature` makes the card render with the dark feature styling.
--
-- Idempotent: json_set only writes if `$.items` is not already present
-- (operator may have edited via /admin/pages). Otherwise no-op.
-- =====================================================================

UPDATE page_sections
SET
  payload_json = json_set(
    COALESCE(payload_json, '{}'),
    '$.items',
    json('[
      {
        "pill": "Early bird",
        "title": "30% off Pro for the first 100 agencies — for life.",
        "body": "Lock in launch pricing while we finish citation history. Subscription stays at the discount as long as you renew. 17 of 100 spots claimed.",
        "code": "EARLYBIRD30",
        "cta_label": "Claim my spot →",
        "cta_url": "pricing.html",
        "meta": "17 / 100 claimed · Ends June 30, 2026",
        "is_feature": true
      },
      {
        "pill": "Guarantee",
        "title": "30-day money-back guarantee.",
        "body": "Try Starter or Pro for a month. If it doesn''t fit your WordPress workflow, email us — we refund the full amount, no questions.",
        "code": "",
        "cta_label": "How it works →",
        "cta_url": "faq.html#pricing",
        "meta": "Auto via Lemon Squeezy",
        "is_feature": false
      },
      {
        "pill": "Switch & save",
        "title": "Already paying Yoast Premium or Rank Math Pro?",
        "body": "Forward your last invoice to switch@quotedeasy.com and we''ll cover your first 3 months on Starter or Pro.",
        "code": "",
        "cta_label": "Forward invoice →",
        "cta_url": "mailto:switch@quotedeasy.com",
        "meta": "Yoast · Rank Math · AIOSEO · SEOPress",
        "is_feature": false
      },
      {
        "pill": "Partner",
        "title": "Agency partner program.",
        "body": "Manage 5+ client sites? Get listed on our partner page, earn 25% recurring on every client you sign up, and unlock the Pro features across your client portfolio.",
        "code": "",
        "cta_label": "Apply →",
        "cta_url": "mailto:partners@quotedeasy.com",
        "meta": "25% recurring · co-marketing",
        "is_feature": false
      },
      {
        "pill": "Non-profit & edu",
        "title": "50% off for schools and registered non-profits.",
        "body": "Sites running on .edu, .ac, or registered 501(c) / equivalent get half off Starter or Pro for the lifetime of the subscription. One simple verification email.",
        "code": "",
        "cta_label": "Get verified →",
        "cta_url": "mailto:edu@quotedeasy.com",
        "meta": "Universities · NGOs · libraries",
        "is_feature": false
      },
      {
        "pill": "Refer",
        "title": "Refer a friend. Get a month free.",
        "body": "Every paying customer you refer credits one free month to your account. Stack them — your subscription can pay for itself with three referrals a year.",
        "code": "",
        "cta_label": "Get my link →",
        "cta_url": "pricing.html",
        "meta": "1 month free per signup · no cap",
        "is_feature": false
      }
    ]')
  ),
  updated_at = datetime('now')
WHERE tenant_id = 1
  AND page_key = 'quoted_home'
  AND section_key = 'programs'
  AND json_extract(payload_json, '$.items') IS NULL;
