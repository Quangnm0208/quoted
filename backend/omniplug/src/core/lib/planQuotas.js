/**
 * core/lib/planQuotas.js — Plan tier definitions.
 *
 * Single source of truth for what each plan unlocks. Used by:
 *   - License middleware (gating /api/v1/*)
 *   - Soft-lock banner (masking quota messaging)
 *   - Maskers (deciding when to PII-mask)
 *   - Attribution middleware (which tier of attribution headers)
 *
 * Tiers (Vietnamese market pricing — see business memory):
 *   community  — Free. 500 leads, masked PII, L1 attribution badge
 *   lite       — 12tr/Lite Landing. 5,000 leads, full PII, L2 attribution
 *   standard   — 25tr/Standard. 50,000 leads, full PII, L3 attribution
 *   pro        — 50tr/Pro. 200,000 leads, full features, no attribution
 *   pro_plus   — 80-120tr/Pro+. 1,000,000 leads, full features, no attribution
 *
 * Plan affects:
 *   - leads.* unmasked vs masked
 *   - api_keys daily call quota
 *   - soft-lock activation (community-only)
 *   - attribution level (L1/L2/L3 vs none)
 */

export const PLANS = ['community', 'lite', 'standard', 'pro', 'pro_plus'];

const QUOTAS = {
  community: {
    label: 'Community Free',
    lead_cap: 500,
    api_calls_per_day: 1_000,
    pii_masked: true,
    attribution_level: 'L1',           // "Powered by OmniPlug" badge, visible
    soft_lock: true,                   // /api/v1/* gated, banner shown
    features: { sdk: false, crm: false, webhooks: false, ai_detect: false },
  },
  lite: {
    label: 'Lite Landing',
    lead_cap: 5_000,
    api_calls_per_day: 25_000,
    pii_masked: false,
    attribution_level: 'L2',           // smaller badge, still visible
    soft_lock: false,
    features: { sdk: true, crm: false, webhooks: false, ai_detect: false },
  },
  standard: {
    label: 'Standard',
    lead_cap: 50_000,
    api_calls_per_day: 100_000,
    pii_masked: false,
    attribution_level: 'L3',           // footer-only meta-tag attribution
    soft_lock: false,
    features: { sdk: true, crm: true, webhooks: false, ai_detect: true },
  },
  pro: {
    label: 'Pro',
    lead_cap: 200_000,
    api_calls_per_day: 500_000,
    pii_masked: false,
    attribution_level: null,            // attribution stripped
    soft_lock: false,
    features: { sdk: true, crm: true, webhooks: true, ai_detect: true },
  },
  pro_plus: {
    label: 'Pro+',
    lead_cap: 1_000_000,
    api_calls_per_day: 2_000_000,
    pii_masked: false,
    attribution_level: null,
    soft_lock: false,
    features: { sdk: true, crm: true, webhooks: true, ai_detect: true },
  },
};

/**
 * Look up plan quotas. Unknown plan → community (defensive: never grant
 * more than free tier on bad data).
 */
export function getPlanQuotas(plan) {
  return QUOTAS[plan] || QUOTAS.community;
}

/**
 * Check if a plan has a feature enabled.
 */
export function planHasFeature(plan, feature) {
  const q = getPlanQuotas(plan);
  return Boolean(q.features && q.features[feature]);
}

/**
 * Check if PII should be masked for this plan.
 */
export function shouldMaskPii(plan) {
  return getPlanQuotas(plan).pii_masked === true;
}

/**
 * Soft lock active for community tier only.
 */
export function isSoftLocked(plan) {
  return getPlanQuotas(plan).soft_lock === true;
}

/**
 * Returns 'L1' | 'L2' | 'L3' | null. null = no attribution required.
 */
export function attributionLevel(plan) {
  return getPlanQuotas(plan).attribution_level;
}
