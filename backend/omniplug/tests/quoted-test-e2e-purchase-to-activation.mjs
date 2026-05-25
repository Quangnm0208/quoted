/**
 * T-E2E-1 — full purchase-to-activation flow against the live backend.
 *
 * Walks the real production sequence (minus the actual LS payment step,
 * which is replaced by synthesised LS webhook payloads we sign ourselves):
 *
 *   1. POST /api/payments/checkout                 — visitor gets URL
 *   2. order_created webhook                       — customer + order
 *   3. subscription_created webhook                — subscription
 *   4. license_key_created webhook                 — license + entitlement
 *   5. POST /api/v1/licenses/activate              — token
 *   6. POST /api/v1/wp-sites/register              — plugin JWT
 *   7. POST /api/v1/wp-sites/posts/sync            — runtime endpoint OK
 *   8. GET  /api/v1/dashboard/summary              — site visible
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:4000';
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const VARIANT = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);

const REQUIREMENTS_MET = !!SECRET && !!VARIANT && process.env.LEMONSQUEEZY_TEST_MODE === 'true';

function eid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function sign(body) { return crypto.createHmac('sha256', SECRET).update(body).digest('hex'); }

async function webhook(payload) {
  const body = JSON.stringify(payload);
  const res = await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': sign(body) },
    body,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function postJson(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function getJson(path, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('T-E2E-1: purchase → webhook → activate → register → sync → dashboard', { skip: !REQUIREMENTS_MET }, async () => {
  const SUFFIX = eid('e2e');
  const CUSTOMER_EMAIL = `e2e-${SUFFIX}@test.local`;
  const CUSTOMER_ID    = 50000 + Math.floor(Math.random() * 1000);
  const ORDER_ID       = String(40000 + Math.floor(Math.random() * 1000));
  const SUB_ID         = String(30000 + Math.floor(Math.random() * 1000));
  const LICENSE_ID     = 20000 + Math.floor(Math.random() * 1000);
  const LICENSE_KEY    = `${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(2).toString('hex')}-${crypto.randomBytes(2).toString('hex')}-${crypto.randomBytes(2).toString('hex')}-${crypto.randomBytes(6).toString('hex')}`;
  const SITE_DOMAIN    = `e2e-${SUFFIX}.test`;
  const SITE_URL       = `https://${SITE_DOMAIN}`;

  // 1. Visitor gets checkout URL.
  const co = await postJson('/api/payments/checkout', { plan: 'pro-monthly' });
  assert.equal(co.status, 200, 'checkout failed');
  assert.ok(co.body?.checkout_url, 'checkout_url required');

  // 2-4. LS sends the post-payment webhook sequence.
  const o = await webhook({
    meta: { event_name: 'order_created', webhook_id: eid('e2e-o') },
    data: { id: ORDER_ID, type: 'orders', attributes: {
      user_email: CUSTOMER_EMAIL, user_name: 'E2E Buyer', customer_id: CUSTOMER_ID,
      total: 1900, currency: 'USD', status: 'paid',
    } },
  });
  assert.equal(o.status, 200);

  const s = await webhook({
    meta: { event_name: 'subscription_created', webhook_id: eid('e2e-s') },
    data: { id: SUB_ID, type: 'subscriptions', attributes: {
      user_email: CUSTOMER_EMAIL, customer_id: CUSTOMER_ID,
      variant_id: VARIANT, status: 'active',
      renews_at: '2027-06-01T00:00:00Z',
    } },
  });
  assert.equal(s.status, 200);
  assert.equal(s.body?.ok, true, `subscription handler error: ${s.body?.error}`);

  const l = await webhook({
    meta: { event_name: 'license_key_created', webhook_id: eid('e2e-l') },
    data: { id: String(LICENSE_ID), type: 'license-keys', attributes: {
      user_email: CUSTOMER_EMAIL, customer_id: CUSTOMER_ID,
      variant_id: VARIANT, subscription_id: SUB_ID,
      key: LICENSE_KEY, status: 'active',
      activation_limit: 1, instances_count: 0,
    } },
  });
  assert.equal(l.status, 200);
  assert.equal(l.body?.ok, true, `license handler error: ${l.body?.error}`);

  // 5. Plugin activates.
  const act = await postJson('/api/v1/licenses/activate', {
    license_key: LICENSE_KEY,
    site_url: SITE_URL,
    plugin_version: '0.4.0',
    wp_version: '6.5',
  });
  assert.equal(act.status, 201, `activate failed: ${JSON.stringify(act.body)}`);
  assert.ok(act.body?.activation_token);
  assert.equal(act.body?.plan, 'pro-monthly');
  const activationToken = act.body.activation_token;

  // 6. Plugin registers the WP site.
  const reg = await postJson('/api/v1/wp-sites/register', {
    activation_token: activationToken,
    domain: SITE_DOMAIN,
    site_name: 'E2E test site',
    plugin_version: '0.4.0',
    wp_version: '6.5',
  });
  assert.equal(reg.status, 201, `register failed: ${JSON.stringify(reg.body)}`);
  assert.ok(reg.body?.jwt, 'plugin JWT required');
  assert.equal(reg.body?.plan, 'pro');
  const pluginJwt = reg.body.jwt;

  // 7. Plugin can use the JWT on runtime endpoints.
  const sync = await postJson('/api/v1/wp-sites/posts/sync', {
    posts: [{
      wp_post_id: 1, slug: 'e2e-hello', title: 'Hello from e2e',
      content_html: '<p>x</p>',
      published_at: '2026-05-25T00:00:00Z', modified_at: '2026-05-25T00:00:00Z',
      url: `${SITE_URL}/e2e-hello/`,
    }],
  }, pluginJwt);
  assert.equal(sync.status, 200);
  assert.equal(sync.body?.synced, 1);

  // 8. Dashboard reflects the site state.
  const dash = await getJson('/api/v1/dashboard/summary?days=7', pluginJwt);
  assert.equal(dash.status, 200);
  assert.equal(dash.body?.posts?.synced, 1);
});
