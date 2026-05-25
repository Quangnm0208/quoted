/**
 * Payments service — checkout URL resolution + plan listing.
 *
 * The vendor-specific logic (LS hosted-URL lookup, future Stripe API call)
 * lives in providers/<vendor>/. This file is purely the vendor-agnostic
 * orchestration:
 *   1. Resolve the plan from plans.config.
 *   2. Pick the provider that serves it.
 *   3. Delegate.
 */

import { getPlan, publicPlanView, PLANS } from '../plans/plans.config.js';
import { getProviderForPlan } from '../providers/index.js';

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
export async function createCheckout({ plan, email }) {
  const planObj = getPlan(plan);
  if (!planObj) throw err('INVALID_PLAN', `Unknown plan: ${plan}`, 400);

  const provider = getProviderForPlan(planObj);
  return provider.createCheckout({ plan: planObj.id, email });
}

export function listPublicPlans() {
  return PLANS.map(publicPlanView);
}
