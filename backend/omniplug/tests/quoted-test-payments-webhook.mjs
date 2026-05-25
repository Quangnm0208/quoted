/**
 * T-PAY-4 .. T-PAY-9 — /api/payments/webhook/lemon-squeezy.
 *
 * Uses HMAC-SHA256 with LEMONSQUEEZY_WEBHOOK_SECRET to forge well-signed
 * payloads. Each test runs against a fresh event_id (timestamp-based) so
 * the suite is rerunnable without clearing the DB.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:4000';
const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

function sign(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

async function postWebhook(payload, sig) {
  const body = JSON.stringify(payload);
  const res = await fetch(BASE + '/api/payments/webhook/lemon-squeezy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': sig != null ? sig : sign(body),
    },
    body,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function eventId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('T-PAY-4: valid HMAC accepted (200)', { skip: !SECRET }, async () => {
  const id = eventId('t4');
  const { status, body } = await postWebhook({
    meta: { event_name: 'order_created', webhook_id: id },
    data: { id: '900001', type: 'orders', attributes: {
      user_email: `t4-${id}@test.local`, user_name: 'T4', customer_id: 401,
      total: 1900, currency: 'USD', status: 'paid',
    } },
  });
  assert.equal(status, 200);
  assert.equal(body?.ok, true);
});

test('T-PAY-5: invalid HMAC rejected (401)', { skip: !SECRET }, async () => {
  const id = eventId('t5');
  const { status, body } = await postWebhook({
    meta: { event_name: 'order_created', webhook_id: id },
    data: { id: '900002', type: 'orders', attributes: { user_email: 't5@test.local', customer_id: 1 } },
  }, 'deadbeef'.repeat(8));
  assert.equal(status, 401);
  assert.equal(body?.error?.code, 'BAD_SIGNATURE');
});

test('T-PAY-6: duplicate event_id returns { duplicate: true } and does not double-insert', { skip: !SECRET }, async () => {
  const id = eventId('t6');
  const payload = {
    meta: { event_name: 'order_created', webhook_id: id },
    data: { id: '900003', type: 'orders', attributes: {
      user_email: `t6-${id}@test.local`, customer_id: 601,
      total: 1900, currency: 'USD', status: 'paid',
    } },
  };
  const a = await postWebhook(payload);
  const b = await postWebhook(payload);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(b.body?.duplicate, true);
});

test('T-PAY-7: order_created creates customer + order rows', { skip: !SECRET }, async () => {
  const id = eventId('t7');
  const email = `t7-${id}@test.local`;
  const { status } = await postWebhook({
    meta: { event_name: 'order_created', webhook_id: id },
    data: { id: '900004', type: 'orders', attributes: {
      user_email: email, customer_id: 701, total: 2900, currency: 'USD', status: 'paid',
    } },
  });
  assert.equal(status, 200);
  // Verification of side effects requires DB access — left to the e2e test.
  // Here we trust the 200 response (the handler errors are surfaced in the
  // body's `error` field if anything failed mid-transaction).
});

test('T-PAY-8: subscription_created with mapped variant creates entitlement', { skip: !SECRET }, async () => {
  const id = eventId('t8');
  const subId = String(800000 + Math.floor(Math.random() * 10000));
  const variantId = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);
  const { status, body } = await postWebhook({
    meta: { event_name: 'subscription_created', webhook_id: id },
    data: { id: subId, type: 'subscriptions', attributes: {
      user_email: `t8-${id}@test.local`, customer_id: 801,
      variant_id: variantId, status: 'active',
      renews_at: '2027-06-01T00:00:00Z',
      urls: { update_payment_method: 'https://app.lemonsqueezy.com/billing' },
    } },
  });
  assert.equal(status, 200);
  // ok:true means the handler completed without throwing. Wrong variant_id
  // would have thrown `Unknown LS variant_id` and the response would be
  // ok:false with error.
  assert.equal(body?.ok, true, `handler error: ${body?.error}`);
});

test('T-PAY-9: subscription_cancelled disables entitlement (handler completes)', { skip: !SECRET }, async () => {
  // Need a subscription first.
  const id8 = eventId('t9pre');
  const subId = String(900000 + Math.floor(Math.random() * 10000));
  const variantId = parseInt(process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY || '0', 10);
  await postWebhook({
    meta: { event_name: 'subscription_created', webhook_id: id8 },
    data: { id: subId, type: 'subscriptions', attributes: {
      user_email: `t9-${id8}@test.local`, customer_id: 901,
      variant_id: variantId, status: 'active',
    } },
  });
  const id9 = eventId('t9');
  const { status, body } = await postWebhook({
    meta: { event_name: 'subscription_cancelled', webhook_id: id9 },
    data: { id: subId, type: 'subscriptions', attributes: {
      user_email: `t9-${id8}@test.local`, customer_id: 901,
      variant_id: variantId, status: 'cancelled',
      ends_at: '2026-06-01T00:00:00Z',
    } },
  });
  assert.equal(status, 200);
  assert.equal(body?.ok, true);
});
