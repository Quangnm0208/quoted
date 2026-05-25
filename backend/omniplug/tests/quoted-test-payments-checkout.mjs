/**
 * T-PAY-1 .. T-PAY-3 — /api/payments/checkout.
 *
 * Runs against a live backend. The test harness assumes:
 *   - server up on BASE (default http://localhost:4000)
 *   - LEMONSQUEEZY_CHECKOUT_PRO_MONTHLY env set (a test URL)
 *   - LEMONSQUEEZY_API_KEY *not* in any response body
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:4000';

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

test('T-PAY-1: valid plan returns checkout URL', async () => {
  const { status, body } = await post('/api/payments/checkout', { plan: 'pro-monthly' });
  assert.equal(status, 200);
  assert.ok(body && typeof body.checkout_url === 'string', 'body.checkout_url required');
  assert.ok(body.checkout_url.startsWith('http'), `checkout_url must be absolute URL: ${body.checkout_url}`);
});

test('T-PAY-2: invalid plan rejected with INVALID_PLAN (400)', async () => {
  const { status, body } = await post('/api/payments/checkout', { plan: 'does-not-exist' });
  assert.equal(status, 400);
  assert.equal(body?.error?.code, 'INVALID_PLAN');
});

test('T-PAY-3: response never contains LEMONSQUEEZY_API_KEY value', async () => {
  const { body } = await post('/api/payments/checkout', { plan: 'pro-monthly' });
  const apiKey = process.env.LEMONSQUEEZY_API_KEY || '';
  if (apiKey) {
    const dump = JSON.stringify(body);
    assert.ok(!dump.includes(apiKey), 'LS_API_KEY leaked in response body');
  }
});
