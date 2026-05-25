/**
 * Payments service — checkout URL resolution (Mode A) + plan listing.
 *
 * Mode A: env carries the LS hosted-checkout URL per plan.
 * Mode B (future): env carries the LS variant_id and we'd call
 *   POST https://api.lemonsqueezy.com/v1/checkouts here. We don't do that
 *   today — the controller falls back to a clear error if a plan only has
 *   variant_env (Mode B-ready) but no checkout_env set.
 */

import { getPlan, publicPlanView, PLANS } from '../plans/plans.config.js';

function err(code, message, httpStatus = 400) {
  const e = new Error(message);
  e.code = code;
  e.httpStatus = httpStatus;
  return e;
}

/**
 * Resolve the checkout URL for a given plan.
 * Returns { checkout_url } or throws a structured error.
 */
export function createCheckout({ plan, email }) {
  const planObj = getPlan(plan);
  if (!planObj) throw err('INVALID_PLAN', `Unknown plan: ${plan}`, 400);

  const hostedUrl = process.env[planObj.checkout_env];
  if (!hostedUrl) {
    throw err(
      'CHECKOUT_NOT_CONFIGURED',
      `Plan "${plan}" has no hosted checkout URL configured (set ${planObj.checkout_env}).`,
      503,
    );
  }

  // Mode A: append email + checkout_data as query params if provided.
  // LS hosted checkout supports ?checkout[email]=... prefill since 2024.
  let url = hostedUrl;
  if (email) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}checkout[email]=${encodeURIComponent(email)}`;
  }

  return { checkout_url: url };
}

export function listPublicPlans() {
  return PLANS.map(publicPlanView);
}
