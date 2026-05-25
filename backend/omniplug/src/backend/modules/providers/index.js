/**
 * Provider registry — single source of truth for which payment vendors
 * the backend knows about.
 *
 * Adding a new provider: import + add to PROVIDERS. The webhook URL
 * /api/payments/webhook/<id> auto-dispatches. No other code changes.
 * See providers/_interface.md for the PaymentProvider contract.
 */

import lemonSqueezyProvider from './lemon-squeezy/index.js';

const PROVIDERS = new Map([
  [lemonSqueezyProvider.id, lemonSqueezyProvider],
  // Future:
  // [stripeProvider.id, stripeProvider],
  // [paddleProvider.id, paddleProvider],
]);

/**
 * Look up a provider by id (the URL :vendor segment). Returns null if
 * unknown — caller returns 404 UNKNOWN_PROVIDER.
 */
export function getProvider(id) {
  return PROVIDERS.get(String(id || '').toLowerCase()) || null;
}

/**
 * For each plan in plans.config.js, decide which provider serves it.
 * For now every plan is Lemon Squeezy. Future: plans can declare
 * `plan.provider = 'stripe'` and this looks at that field.
 */
export function getProviderForPlan(plan) {
  return PROVIDERS.get(plan?.provider || lemonSqueezyProvider.id) || lemonSqueezyProvider;
}

/**
 * List all registered provider ids — used by docs + admin UI.
 */
export function listProviderIds() {
  return Array.from(PROVIDERS.keys());
}
