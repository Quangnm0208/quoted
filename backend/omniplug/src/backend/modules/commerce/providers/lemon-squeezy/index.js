/**
 * Lemon Squeezy PaymentProvider implementation.
 *
 * The vendor-agnostic webhook router + license service import this via
 * `providers/index.js` — they never reach into ls.* directly.
 */

import { verifyWebhookSignature, callLicenseApi } from './ls.client.js';
import { handleEvent as lsHandleEvent, SUPPORTED_EVENTS } from './ls.webhook.handler.js';
import { getPlan } from '../../plans/plans.config.js';

const PROVIDER_ID = 'lemon-squeezy';

export const lemonSqueezyProvider = {
  id: PROVIDER_ID,

  // ─── Webhook ────────────────────────────────────────────────────────
  verifyWebhookSignature(rawBody, headers) {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) return false;
    const sig = headers['x-signature'] || headers['X-Signature'] || '';
    return verifyWebhookSignature(rawBody, sig, secret);
  },

  parseEvent(payload) {
    const event_name = payload?.meta?.event_name;
    const event_id   = payload?.meta?.webhook_id || payload?.meta?.event_id;
    if (!event_name || !event_id) return null;
    return { event_id, event_name, raw: payload };
  },

  isSupportedEvent(event_name) {
    return SUPPORTED_EVENTS.has(event_name);
  },

  async handleEvent(event_name, payload) {
    return lsHandleEvent(event_name, payload);
  },

  // ─── Checkout (Mode A — hosted URL from env) ────────────────────────
  async createCheckout({ plan, email }) {
    const planObj = getPlan(plan);
    if (!planObj) {
      const e = new Error(`Unknown plan: ${plan}`);
      e.code = 'INVALID_PLAN';
      e.httpStatus = 400;
      throw e;
    }
    const hostedUrl = process.env[planObj.checkout_env];
    if (!hostedUrl) {
      const e = new Error(`Plan "${plan}" has no hosted checkout URL configured (set ${planObj.checkout_env}).`);
      e.code = 'CHECKOUT_NOT_CONFIGURED';
      e.httpStatus = 503;
      throw e;
    }
    let url = hostedUrl;
    if (email) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}checkout[email]=${encodeURIComponent(email)}`;
    }
    return { checkout_url: url };
  },

  // ─── License lifecycle ──────────────────────────────────────────────
  async activateLicense({ license_key, instance_name }) {
    const res = await callLicenseApi('/licenses/activate', { license_key, instance_name });
    if (res.status === 0) return { ok: false, unreachable: true };
    if (!res.ok || !res.body?.activated) return { ok: false, error: res.body?.error || 'not_activated' };
    return {
      ok: true,
      license_meta: {
        lemon_license_id: res.body.license_key?.id,
        customer_email:   res.body.meta?.customer_email,
        customer_id:      res.body.meta?.customer_id,
        customer_name:    res.body.meta?.customer_name,
        variant_id:       res.body.meta?.variant_id,
        status:           res.body.license_key?.status || 'active',
        activation_limit: res.body.license_key?.activation_limit || 1,
        activation_usage: res.body.license_key?.activation_usage || 0,
        expires_at:       res.body.license_key?.expires_at || null,
      },
    };
  },

  async validateLicense({ license_key }) {
    const res = await callLicenseApi('/licenses/validate', { license_key });
    if (res.status === 0) return { ok: false, unreachable: true };
    if (!res.ok || !res.body?.valid) return { ok: false, error: res.body?.error || 'invalid' };
    return { ok: true, license_status: res.body.license_key?.status || 'active' };
  },

  async deactivateLicense({ license_key, instance_id }) {
    const res = await callLicenseApi('/licenses/deactivate', { license_key, instance_id });
    if (res.status === 0) return { ok: false, unreachable: true };
    return { ok: !!res.body?.deactivated };
  },
};

export default lemonSqueezyProvider;
