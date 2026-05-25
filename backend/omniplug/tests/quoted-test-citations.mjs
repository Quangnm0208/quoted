/**
 * T-CIT — citations module (v0.4.1, no longer a stub).
 *
 * Requires CITATIONS_TEST_MODE=true so the Perplexity provider returns a
 * synthetic owned-URL match for any query. Without it the test skips —
 * production runs would need a real PERPLEXITY_API_KEY.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE   = process.env.BASE || 'http://127.0.0.1:4000';
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
const VARIANT = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);
const READY  = !!SECRET && !!VARIANT && process.env.CITATIONS_TEST_MODE === 'true';

let PJWT = '';
let SITE_DOMAIN = '';

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

// Seed a customer + license + WP site so we have a plugin JWT to call /citations.
before(async () => {
  if (!READY) return;
  const id = Date.now();
  SITE_DOMAIN = `t-cit-${id}.test`;
  const key = `${crypto.randomBytes(4).toString('hex')}-cccc-cccc-cccc-${crypto.randomBytes(6).toString('hex')}`;
  const payload = JSON.stringify({
    meta: { event_name: 'license_key_created', webhook_id: `t-cit-${id}` },
    data: { id: String(900000 + (id % 100000)), type: 'license-keys', attributes: {
      user_email: `t-cit-${id}@test.local`, customer_id: 9000 + (id % 1000),
      variant_id: VARIANT, key, status: 'active', activation_limit: 5, instances_count: 0,
    } },
  });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': sig }, body: payload,
  });
  const act = await postJson('/api/v1/licenses/activate', {
    license_key: key, site_url: `https://${SITE_DOMAIN}`,
  });
  const token = act.body?.activation_token;
  const reg = await postJson('/api/v1/wp-sites/register', {
    activation_token: token, domain: SITE_DOMAIN, site_name: 'cit',
  });
  PJWT = reg.body?.jwt || '';
  // Sync a post so canonical-URL matching can score 1.0.
  await postJson('/api/v1/wp-sites/posts/sync', {
    posts: [{
      wp_post_id: 1, slug: 'hello', title: 'Hello',
      content_html: '<p>x</p>',
      published_at: '2026-04-15T00:00:00Z', modified_at: '2026-04-15T00:00:00Z',
      url: `https://${SITE_DOMAIN}/best-running-shoes-2026/`,
    }],
  }, PJWT);
});

test('T-CIT-1: GET /citations returns empty initially', { skip: !READY }, async () => {
  const r = await getJson('/api/v1/citations', PJWT);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body?.citations));
  assert.ok(typeof r.body?.total === 'number');
});

test('T-CIT-2: POST /citations/sync (test mode) matches owned URL', { skip: !READY }, async () => {
  const r = await postJson('/api/v1/citations/sync', {
    queries: ['best running shoes for marathon'],
  }, PJWT);
  assert.equal(r.status, 200);
  assert.ok(r.body?.matched >= 1, `expected ≥1 match, got: ${JSON.stringify(r.body)}`);
  assert.ok(r.body?.providers_used.includes('perplexity'));
});

test('T-CIT-3: POST /citations/submit accepts user-curated entry', { skip: !READY }, async () => {
  const r = await postJson('/api/v1/citations/submit', {
    query: 'manual entry',
    cited_url: `https://${SITE_DOMAIN}/best-running-shoes-2026/`,
    confidence: 0.9,
  }, PJWT);
  assert.equal(r.status, 201);
  assert.equal(r.body?.ok, true);
});

test('T-CIT-4: POST /citations/submit rejects non-owned URL', { skip: !READY }, async () => {
  const r = await postJson('/api/v1/citations/submit', {
    query: 'wrong',
    cited_url: 'https://not-my-site.com/page',
  }, PJWT);
  assert.equal(r.status, 400);
  assert.equal(r.body?.error?.code, 'URL_NOT_OWNED');
});

test('T-CIT-5: GET /citations/summary returns verified + likely counts', { skip: !READY }, async () => {
  const r = await getJson('/api/v1/citations/summary?days=30', PJWT);
  assert.equal(r.status, 200);
  assert.equal(typeof r.body?.verified_count, 'number');
  assert.equal(typeof r.body?.likely_count, 'number');
});
