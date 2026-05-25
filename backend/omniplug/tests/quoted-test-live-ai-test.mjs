/**
 * T-LAT — live-ai-test module (v0.4.1, no longer a stub).
 *
 * Requires LIVE_AI_TEST_MODE=true so the Perplexity client returns a
 * synthetic answer without needing PERPLEXITY_API_KEY.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:4000';
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const VARIANT = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);
const READY = !!SECRET && !!VARIANT && process.env.LIVE_AI_TEST_MODE === 'true';

let PJWT = '';
let DOMAIN = '';

async function postJson(path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method: 'POST', headers: h, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function getJson(path, token) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { headers: h });
  return { status: res.status, body: await res.json().catch(() => null) };
}

before(async () => {
  if (!READY) return;
  const id = Date.now();
  DOMAIN = `t-lat-${id}.test`;
  const key = `${crypto.randomBytes(4).toString('hex')}-lll-lll-lll-${crypto.randomBytes(6).toString('hex')}`;
  const payload = JSON.stringify({
    meta: { event_name: 'license_key_created', webhook_id: `t-lat-${id}` },
    data: { id: String(910000 + (id % 100000)), type: 'license-keys', attributes: {
      user_email: `t-lat-${id}@test.local`, customer_id: 91000 + (id % 1000),
      variant_id: VARIANT, key, status: 'active', activation_limit: 5, instances_count: 0,
    } },
  });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': sig }, body: payload,
  });
  const act = await postJson('/api/v1/licenses/activate', { license_key: key, site_url: `https://${DOMAIN}` });
  const reg = await postJson('/api/v1/wp-sites/register', {
    activation_token: act.body?.activation_token, domain: DOMAIN, site_name: 'lat',
  });
  PJWT = reg.body?.jwt || '';
});

test('T-LAT-1: GET /live-test/quota returns counters', { skip: !READY }, async () => {
  const r = await getJson('/api/v1/live-test/quota', PJWT);
  assert.equal(r.status, 200);
  assert.equal(typeof r.body?.used_this_month, 'number');
  assert.equal(typeof r.body?.limit, 'number');
  assert.equal(typeof r.body?.remaining, 'number');
  assert.equal(typeof r.body?.resets_at, 'string');
});

test('T-LAT-2: POST /live-test/query returns answer + cited URLs', { skip: !READY }, async () => {
  const r = await postJson('/api/v1/live-test/query', {
    prompt: 'what are the best running shoes for marathon training?',
  }, PJWT);
  assert.equal(r.status, 200);
  assert.equal(typeof r.body?.answer, 'string');
  assert.ok(Array.isArray(r.body?.citations));
  assert.ok(r.body.citations.length >= 1);
  // Test mode injects an owned URL — at least one should be flagged cited.
  assert.ok(r.body.citations.some(c => c.cited === true), 'expected ≥1 cited:true');
  // Quota bumped by 1.
  assert.ok(r.body?.quota?.used_this_month >= 1);
});

test('T-LAT-3: query bumps quota', { skip: !READY }, async () => {
  const before = await getJson('/api/v1/live-test/quota', PJWT);
  await postJson('/api/v1/live-test/query', { prompt: 'follow-up prompt' }, PJWT);
  const after  = await getJson('/api/v1/live-test/quota', PJWT);
  assert.equal(after.body.used_this_month, before.body.used_this_month + 1);
});

test('T-LAT-4: query rejects short prompt with 400', { skip: !READY }, async () => {
  const r = await postJson('/api/v1/live-test/query', { prompt: 'x' }, PJWT);
  assert.equal(r.status, 400);
  assert.equal(r.body?.error?.code, 'INVALID_REQUEST');
});

test('T-LAT-5: query auto-records cite into citations table', { skip: !READY }, async () => {
  await postJson('/api/v1/live-test/query', {
    prompt: 'unique prompt for cite recording test',
  }, PJWT);
  const r = await getJson('/api/v1/citations?source=live_ai_test', PJWT);
  assert.equal(r.status, 200);
  assert.ok(r.body?.total >= 1, 'expected at least 1 live_ai_test cite');
  assert.equal(r.body.citations[0].source, 'live_ai_test');
});
