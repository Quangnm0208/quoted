/**
 * Lemon Squeezy API client — thin wrapper around the bits we use.
 *
 * Two responsibilities:
 *   1. HMAC verification of incoming webhooks (the only crypto we run).
 *   2. License API calls — activate/validate/deactivate proxied from the
 *      plugin so the LS_API_KEY never leaves the backend.
 *
 * No SDK dependency — `fetch` is built into Node 22. Keeping this file
 * dependency-free means we can stub it cleanly in tests.
 */

import crypto from 'node:crypto';

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1';

/**
 * Verify the X-Signature header against the raw request body.
 * LS docs: https://docs.lemonsqueezy.com/help/webhooks#signing-requests
 *
 * @param {Buffer|string} rawBody  — request body BEFORE JSON parsing
 * @param {string}        signature — value of X-Signature header
 * @param {string}        secret    — LEMONSQUEEZY_WEBHOOK_SECRET
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const computed = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const cmpBuf = Buffer.from(computed, 'utf8');
  if (sigBuf.length !== cmpBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, cmpBuf);
}

/**
 * Call LS License API. Returns { ok, status, body } — no throws on HTTP
 * failure so the caller can map LS error codes to our envelope cleanly.
 *
 * Test mode: when LEMONSQUEEZY_TEST_MODE=true, every License API call
 * returns a synthetic success response — useful for local dev/CI where
 * we can't reach api.lemonsqueezy.com. Production MUST leave this unset.
 *
 * @param {string} path    — '/licenses/activate' | '/validate' | '/deactivate'
 * @param {object} payload — form-encoded fields LS expects (license_key, instance_name, etc.)
 */
export async function callLicenseApi(path, payload) {
  if (process.env.LEMONSQUEEZY_TEST_MODE === 'true') {
    return mockLicenseApiResponse(path, payload);
  }
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, body: { error: 'LEMONSQUEEZY_API_KEY not configured' } };
  }
  const url = LS_API_BASE + path;
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) {
    if (v != null) form.append(k, String(v));
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { error: 'network', message: err.message } };
  }
}

/**
 * Synthetic LS response for local dev / CI. Mirrors the shape of the real
 * LS License API responses (https://docs.lemonsqueezy.com/api/license-api)
 * so callers don't need a parallel codepath. Activation/deactivation always
 * "succeeds"; the local DB is the source of truth in test mode.
 */
function mockLicenseApiResponse(path, payload) {
  if (path === '/licenses/activate') {
    return {
      ok: true,
      status: 200,
      body: {
        activated: true,
        instance: { id: `mock-${Date.now()}`, name: payload.instance_name },
        license_key: {
          id: 999999,
          status: 'active',
          activation_limit: 3,
          activation_usage: 1,
          expires_at: null,
        },
        meta: {
          customer_id: 777,
          customer_email: 'test-mode@local',
          customer_name: 'Test Mode',
          variant_id: 100001,
        },
      },
    };
  }
  if (path === '/licenses/validate') {
    return {
      ok: true, status: 200,
      body: { valid: true, license_key: { status: 'active' } },
    };
  }
  if (path === '/licenses/deactivate') {
    return { ok: true, status: 200, body: { deactivated: true } };
  }
  return { ok: false, status: 404, body: { error: 'mock: unknown path' } };
}
