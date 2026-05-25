/**
 * Plan registry — single source of truth for plan IDs, prices, and the
 * LS hosted checkout URLs (Mode A).
 *
 * To add a plan: add it here AND set the matching env var. The plan_id
 * MUST also be in the SUBSCRIPTION_PLANS set referenced by webhook.handlers.js
 * (we accept the plan from LS variant_id reverse-lookup at webhook time).
 *
 * Mode A (current): env carries the LS hosted-checkout URL per plan.
 * Mode B (later):   env carries the LS variant_id; payments.service.js
 *                   calls LS Create Checkout API. Toggle is per-plan —
 *                   if both URL and VARIANT are set, URL wins.
 */

export const PLANS = [
  {
    id: 'pro-monthly',
    name: 'Pro Monthly',
    tier: 'pro',
    billing_cycle: 'monthly',
    price_usd: 19,
    features: ['llms_txt_unlimited', 'history_12mo', 'citations', 'live_ai_test'],
    checkout_env: 'LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY',
    variant_env:  'LEMONSQUEEZY_VARIANT_PRO_MONTHLY',
  },
  {
    id: 'pro-yearly',
    name: 'Pro Yearly',
    tier: 'pro',
    billing_cycle: 'yearly',
    price_usd: 190,
    features: ['llms_txt_unlimited', 'history_12mo', 'citations', 'live_ai_test'],
    checkout_env: 'LEMONSQUEEZY_CHECKOUT_PRO_YEARLY',
    variant_env:  'LEMONSQUEEZY_VARIANT_PRO_YEARLY',
  },
  {
    id: 'agency-monthly',
    name: 'Agency Monthly',
    tier: 'agency',
    billing_cycle: 'monthly',
    price_usd: 29,
    features: ['llms_txt_unlimited', 'history_12mo', 'citations', 'live_ai_test', 'sites_5', 'white_label'],
    checkout_env: 'LEMONSQUEEZY_CHECKOUT_AGENCY_MONTHLY',
    variant_env:  'LEMONSQUEEZY_VARIANT_AGENCY_MONTHLY',
  },
  {
    id: 'agency-yearly',
    name: 'Agency Yearly',
    tier: 'agency',
    billing_cycle: 'yearly',
    price_usd: 290,
    features: ['llms_txt_unlimited', 'history_12mo', 'citations', 'live_ai_test', 'sites_5', 'white_label'],
    checkout_env: 'LEMONSQUEEZY_CHECKOUT_AGENCY_YEARLY',
    variant_env:  'LEMONSQUEEZY_VARIANT_AGENCY_YEARLY',
  },
];

const PLAN_BY_ID = new Map(PLANS.map(p => [p.id, p]));

export function getPlan(planId) {
  return PLAN_BY_ID.get(planId) || null;
}

/**
 * Returns the public view (safe to expose to FE). Strips env names.
 */
export function publicPlanView(plan) {
  return {
    id: plan.id,
    name: plan.name,
    tier: plan.tier,
    billing_cycle: plan.billing_cycle,
    price_usd: plan.price_usd,
    features: plan.features,
  };
}

/**
 * Reverse-lookup: given an LS variant_id (from webhook), return our plan_id.
 * Used by webhook.handlers.js when creating subscriptions/licenses.
 */
export function planIdFromVariantId(variantId) {
  if (variantId == null) return null;
  const target = String(variantId);
  for (const p of PLANS) {
    const env = process.env[p.variant_env];
    if (env && String(env) === target) return p.id;
  }
  return null;
}
