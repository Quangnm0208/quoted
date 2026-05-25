/**
 * T-REG — endpoint response-shape regression snapshot.
 *
 * For each public endpoint the WP plugin or marketing FE talks to, this
 * test asserts the *shape* of the response (which keys are present, what
 * type each value is) — NOT the literal values. Accidental shape drift
 * (renaming a field, changing tenant_id from number to string, dropping
 * features from /licenses/activate) breaks every consumer downstream;
 * this test catches it before deploy.
 *
 * Adding an endpoint: add a row to ENDPOINTS. Shape mismatch → test fails
 * with a diff showing which key drifted.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE   = process.env.BASE || 'http://127.0.0.1:4000';
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const VARIANT_PRO_MONTHLY = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);

/**
 * shapeOf({a: 1, b: 'x', c: [1, 2]}) === '{a:number,b:string,c:array}'
 * shapeOf([{x: 1}])                  === 'array<{x:number}>'
 * Recursive but cheap. Used in deepEqual asserts below.
 */
function shapeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array<${v.length === 0 ? 'unknown' : shapeOf(v[0])}>`;
  const t = typeof v;
  if (t !== 'object') return t;
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => `${k}:${shapeOf(v[k])}`).join(',') + '}';
}

// ── helpers ────────────────────────────────────────────────────────────

async function getJson(path, headers = {}) {
  const res = await fetch(BASE + path, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function postJson(path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ── snapshot specs ─────────────────────────────────────────────────────

test('SHAPE: GET /api/health', async () => {
  const { body } = await getJson('/api/health');
  assert.equal(
    shapeOf(body),
    '{homepage:string,license:string,product:string,status:string,vendor:string,version:string}',
  );
});

test('SHAPE: GET /api/products/plans — public plan catalogue', async () => {
  const { body } = await getJson('/api/products/plans');
  assert.ok(Array.isArray(body.plans), 'plans must be array');
  assert.ok(body.plans.length >= 1, 'at least one plan');
  // Each plan: same shape across the array
  const planShape = shapeOf(body.plans[0]);
  assert.equal(
    planShape,
    '{billing_cycle:string,features:array<string>,id:string,name:string,price_usd:number,tier:string}',
  );
  // All entries must share the shape (no drift between plans).
  for (const p of body.plans) {
    assert.equal(shapeOf(p), planShape, `plan ${p.id} shape drift`);
  }
});

test('SHAPE: POST /api/payments/checkout — success', async () => {
  const { body } = await postJson('/api/payments/checkout', { plan: 'pro-monthly' });
  assert.equal(shapeOf(body), '{checkout_url:string}');
});

test('SHAPE: POST /api/payments/checkout — invalid plan error envelope', async () => {
  const { body } = await postJson('/api/payments/checkout', { plan: 'nope' });
  // Error envelope contract: { error: { code, message, details? } }
  // We don't assert details (may be null or object) — only the required keys.
  assert.equal(typeof body?.error?.code, 'string');
  assert.equal(typeof body?.error?.message, 'string');
});

test('SHAPE: POST /api/payments/webhook/lemon-squeezy — accepted', { skip: !SECRET }, async () => {
  const body = JSON.stringify({
    meta: { event_name: 'order_created', webhook_id: `reg-${Date.now()}` },
    data: { id: '99001', type: 'orders', attributes: {
      user_email: `reg-${Date.now()}@test.local`, customer_id: 99001,
      total: 1900, currency: 'USD', status: 'paid',
    } },
  });
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  const res = await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Signature': sig },
    body,
  });
  const json = await res.json();
  // Shape: { ok: bool, event_name: string }  (duplicate path adds duplicate:bool)
  assert.equal(typeof json?.ok, 'boolean');
});

test('SHAPE: POST /api/v1/licenses/activate — success', { skip: !SECRET || !VARIANT_PRO_MONTHLY }, async () => {
  // Seed a license first via webhook (the rest of this file doesn't rely on test ordering).
  const key = `${crypto.randomBytes(4).toString('hex')}-aaaa-bbbb-cccc-${crypto.randomBytes(6).toString('hex')}`;
  const email = `reg-act-${Date.now()}@test.local`;
  const cid = 30000 + Math.floor(Math.random() * 1000);
  const lid = 40000 + Math.floor(Math.random() * 1000);
  const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
  const sub = JSON.stringify({
    meta: { event_name: 'subscription_created', webhook_id: `reg-sub-${Date.now()}` },
    data: { id: String(50000 + Math.floor(Math.random() * 1000)), type: 'subscriptions',
      attributes: { user_email: email, customer_id: cid, variant_id: VARIANT_PRO_MONTHLY, status: 'active' } },
  });
  await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': sign(sub) }, body: sub,
  });
  const lic = JSON.stringify({
    meta: { event_name: 'license_key_created', webhook_id: `reg-lic-${Date.now()}` },
    data: { id: String(lid), type: 'license-keys', attributes: {
      user_email: email, customer_id: cid, variant_id: VARIANT_PRO_MONTHLY,
      key, status: 'active', activation_limit: 1, instances_count: 0,
    } },
  });
  await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': sign(lic) }, body: lic,
  });

  const { body } = await postJson('/api/v1/licenses/activate', {
    license_key: key, site_url: `https://reg-${Date.now()}.test`,
  });
  // CONTRACT (commits to this shape — plugin depends on it):
  assert.equal(typeof body.activation_token, 'string', 'activation_token must be string');
  assert.equal(typeof body.plan,             'string', 'plan must be string');
  assert.equal(typeof body.plan_tier,        'string', 'plan_tier must be string');
  assert.equal(typeof body.features,         'object', 'features must be object');
  assert.equal(typeof body.activation_limit, 'number', 'activation_limit must be number');
  assert.equal(typeof body.instances_count,  'number', 'instances_count must be number');
  // expires_at may be null or string — both acceptable.
  assert.ok(body.expires_at === null || typeof body.expires_at === 'string');
});

test('SHAPE: GET /api/public/llm/sitemap.txt — text/markdown', async () => {
  const res = await fetch(BASE + '/api/public/llm/sitemap.txt', {
    headers: { 'X-Quoted-Domain': 'localhost' },
  });
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('text/markdown') || ct.includes('text/plain'), `expected markdown, got ${ct}`);
  assert.ok([200, 404].includes(res.status));
});
