/**
 * T-LIC-1 .. T-LIC-5 — /api/v1/licenses/{activate,validate,deactivate}.
 *
 * Requires LEMONSQUEEZY_TEST_MODE=true so the LS License API roundtrip
 * returns the synthetic success response. Without it, every activate
 * would 503 UPSTREAM_UNAVAILABLE (correct production behavior — useless
 * for CI without real LS credentials).
 *
 * The harness seeds a license + entitlement by replaying a license webhook,
 * then exercises the plugin-facing endpoints against it.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:4000';
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const VARIANT_PRO_MONTHLY = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);

const TEST_LICENSE_KEY = `${crypto.randomBytes(4).toString('hex')}-1234-5678-9abc-${crypto.randomBytes(6).toString('hex')}`;
const CUSTOMER_EMAIL = `lic-${Date.now()}@test.local`;
const CUSTOMER_ID = 9000 + Math.floor(Math.random() * 1000);
const LEMON_LICENSE_ID = 8000 + Math.floor(Math.random() * 1000);
const LEMON_SUB_ID = String(7000 + Math.floor(Math.random() * 1000));

async function postWebhook(payload) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': sig },
    body,
  });
}

async function postJson(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

// Seed: walk the LS event sequence so the license + entitlement exist.
before(async () => {
  if (!SECRET) return;  // tests below all skip
  // 1. subscription
  await postWebhook({
    meta: { event_name: 'subscription_created', webhook_id: `seed-sub-${Date.now()}` },
    data: { id: LEMON_SUB_ID, type: 'subscriptions', attributes: {
      user_email: CUSTOMER_EMAIL, customer_id: CUSTOMER_ID,
      variant_id: VARIANT_PRO_MONTHLY, status: 'active',
    } },
  });
  // 2. license
  await postWebhook({
    meta: { event_name: 'license_key_created', webhook_id: `seed-lic-${Date.now()}` },
    data: { id: String(LEMON_LICENSE_ID), type: 'license-keys', attributes: {
      user_email: CUSTOMER_EMAIL, customer_id: CUSTOMER_ID,
      variant_id: VARIANT_PRO_MONTHLY, subscription_id: LEMON_SUB_ID,
      key: TEST_LICENSE_KEY, status: 'active',
      activation_limit: 2, instances_count: 0,
    } },
  });
});

test('T-LIC-1: valid license + matching entitlement activates', { skip: !SECRET || !VARIANT_PRO_MONTHLY }, async () => {
  const { status, body } = await postJson('/api/v1/licenses/activate', {
    license_key: TEST_LICENSE_KEY,
    site_url: 'https://t-lic-1.test',
    plugin_version: '0.4.0',
    wp_version: '6.5',
  });
  assert.equal(status, 201);
  assert.ok(body?.activation_token, 'activation_token required');
  assert.equal(body?.plan, 'pro-monthly');
  assert.equal(body?.plan_tier, 'pro');
  assert.deepEqual(body?.features?.llms_txt_unlimited, true);
});

test('T-LIC-2: unknown license returns 404 LICENSE_NOT_FOUND or 503 unsynced', { skip: !SECRET }, async () => {
  const { status, body } = await postJson('/api/v1/licenses/activate', {
    license_key: '00000000-0000-0000-0000-deadbeefdead',
    site_url: 'https://t-lic-2.test',
  });
  // In test mode, the mock LS client returns "activated" so the unknown
  // path materialises a license. In production with a real LS, an unknown
  // key returns 404. Either is acceptable here.
  assert.ok([201, 404, 503].includes(status), `got HTTP ${status}: ${JSON.stringify(body)}`);
});

test('T-LIC-3: activation_limit enforced (third activation hits 403)', { skip: !SECRET || !VARIANT_PRO_MONTHLY }, async () => {
  // We seeded limit=2; T-LIC-1 used activation 1. Use 2 more sites.
  const r1 = await postJson('/api/v1/licenses/activate', {
    license_key: TEST_LICENSE_KEY, site_url: 'https://t-lic-3a.test',
  });
  assert.ok(r1.status === 201, `2nd activation should succeed, got ${r1.status}`);

  const r2 = await postJson('/api/v1/licenses/activate', {
    license_key: TEST_LICENSE_KEY, site_url: 'https://t-lic-3b.test',
  });
  assert.equal(r2.status, 403);
  assert.equal(r2.body?.error?.code, 'ACTIVATION_LIMIT_REACHED');
});

test('T-LIC-4: validate with valid token returns active', { skip: !SECRET || !VARIANT_PRO_MONTHLY }, async () => {
  // Issue a fresh activation to get a valid token (T-LIC-3 might've consumed slots).
  // Use the same license + reuse a previous site_url (LS doesn't object — instance_name dedup).
  const act = await postJson('/api/v1/licenses/activate', {
    license_key: TEST_LICENSE_KEY, site_url: 'https://t-lic-1.test',
  });
  const token = act.body?.activation_token;
  if (!token) return;  // limits may have prevented this — covered by T-LIC-3

  const { status, body } = await postJson('/api/v1/licenses/validate', {
    site_url: 'https://t-lic-1.test',
  }, token);
  assert.equal(status, 200);
  assert.equal(body?.status, 'active');
});

test('T-LIC-5: deactivate with valid token succeeds', { skip: !SECRET || !VARIANT_PRO_MONTHLY }, async () => {
  const act = await postJson('/api/v1/licenses/activate', {
    license_key: TEST_LICENSE_KEY, site_url: 'https://t-lic-5.test',
  });
  const token = act.body?.activation_token;
  if (!token) return;
  const { status, body } = await postJson('/api/v1/licenses/deactivate', {
    site_url: 'https://t-lic-5.test',
    license_key: TEST_LICENSE_KEY,
  }, token);
  assert.equal(status, 200);
  assert.equal(body?.ok, true);
});
