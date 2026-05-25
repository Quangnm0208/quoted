/**
 * LS webhook entry point + per-event handlers.
 *
 * Flow:
 *   1. Verify HMAC signature against raw body. Bad sig → 401, NOT recorded.
 *   2. Parse event_id from meta.event_id. Missing → 400.
 *   3. INSERT-OR-IGNORE into webhook_events.
 *      - If duplicate (already seen) → return 200 immediately, no handler run.
 *      - Else → mark received, dispatch by event_name.
 *   4. Handler mutates customers/orders/subscriptions/licenses/entitlements
 *      in a single transaction. Errors → markFailed with message + 200
 *      (we don't want LS to retry forever on a logic bug; we want it logged).
 *
 * Supported events (MASTER PROMPT §4):
 *   order_created            — create customer + order
 *   subscription_created     — create subscription + entitlement
 *   subscription_updated     — refresh subscription + entitlement
 *   subscription_cancelled   — disable entitlement
 *   subscription_expired     — disable entitlement
 *   subscription_resumed     — reactivate entitlement
 *   license_key_created      — create license + entitlement
 *   license_key_updated      — refresh license
 *
 * Anything else → recorded as `signature_valid=1, processed=1, error=null`
 * with raw_payload kept for future expansion. Returns 200.
 */

import db from '../../../core/db/connection.js';
import { transaction } from '../../../core/db/connection.js';
import { verifyWebhookSignature } from './lemon-squeezy.client.js';
import * as eventStore from './webhook-events.repository.js';
import { entitlementRepo, hashLicenseKey, shortLicenseKey } from './entitlement.repository.js';
import { planIdFromVariantId, getPlan } from './plans.config.js';

const SUPPORTED = new Set([
  'order_created',
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_resumed',
  'license_key_created',
  'license_key_updated',
]);

/**
 * Top-level entry called by the controller.
 * Returns { httpStatus, body } — controller wraps as the HTTP response.
 */
export async function handleWebhook(rawBody, signatureHeader) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    // Configuration error — refuse silently so we don't leak the gap.
    console.warn('[webhook] LEMONSQUEEZY_WEBHOOK_SECRET not configured — rejecting');
    return { httpStatus: 503, body: { error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Server not configured' } } };
  }

  const sigOk = verifyWebhookSignature(rawBody, signatureHeader || '', secret);
  if (!sigOk) {
    return { httpStatus: 401, body: { error: { code: 'BAD_SIGNATURE', message: 'Signature mismatch' } } };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    return { httpStatus: 400, body: { error: { code: 'INVALID_JSON', message: 'Webhook body not JSON' } } };
  }

  const eventName = payload?.meta?.event_name;
  const eventId   = payload?.meta?.webhook_id || payload?.meta?.event_id;
  if (!eventName || !eventId) {
    return { httpStatus: 400, body: { error: { code: 'INVALID_EVENT', message: 'Missing meta.event_name or webhook_id' } } };
  }

  // Idempotency log.
  const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const { isNew } = eventStore.recordEventIfNew({
    eventId, eventName, signatureValid: true, rawPayload: rawStr,
  });
  if (!isNew) {
    return { httpStatus: 200, body: { ok: true, duplicate: true } };
  }

  if (!SUPPORTED.has(eventName)) {
    // Persist + ack so LS stops retrying; we can backfill later if needed.
    eventStore.markProcessed(eventId);
    return { httpStatus: 200, body: { ok: true, ignored: eventName } };
  }

  try {
    await dispatchHandler(eventName, payload);
    eventStore.markProcessed(eventId);
    return { httpStatus: 200, body: { ok: true, event_name: eventName } };
  } catch (e) {
    eventStore.markFailed(eventId, e.message);
    console.error(`[webhook] handler failed for ${eventName} (event_id=${eventId}):`, e);
    // Still 200 — we logged it and don't want LS to hammer us forever.
    return { httpStatus: 200, body: { ok: false, event_name: eventName, error: e.message } };
  }
}

async function dispatchHandler(eventName, payload) {
  switch (eventName) {
    case 'order_created':         return handleOrderCreated(payload);
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed':  return handleSubscriptionUpsert(payload);
    case 'subscription_cancelled':
    case 'subscription_expired':  return handleSubscriptionEnded(payload);
    case 'license_key_created':
    case 'license_key_updated':   return handleLicenseUpsert(payload);
  }
}

// ─── handlers ────────────────────────────────────────────────────────

function handleOrderCreated(payload) {
  const data = payload?.data?.attributes || {};
  const customerEmail = data.user_email;
  const customerName  = data.user_name;
  const lemonCustomerId = data.customer_id;
  const lemonOrderId  = parseInt(payload?.data?.id, 10);
  if (!customerEmail || !lemonOrderId) throw new Error('order_created missing email or id');

  transaction(() => {
    const customer = entitlementRepo.upsertCustomerByLemon({
      email: customerEmail,
      name: customerName,
      lemon_customer_id: lemonCustomerId,
    });
    entitlementRepo.upsertOrder({
      lemon_order_id: lemonOrderId,
      customer_id: customer.id,
      amount_cents: data.total || 0,
      currency: data.currency || 'USD',
      status: data.status || 'paid',
      raw_payload: JSON.stringify(payload),
    });
  });
}

function handleSubscriptionUpsert(payload) {
  const data = payload?.data?.attributes || {};
  const lemonSubId = parseInt(payload?.data?.id, 10);
  const lemonCustomerId = data.customer_id;
  const variantId = data.variant_id;
  const planId = planIdFromVariantId(variantId);
  if (!planId) throw new Error(`Unknown LS variant_id ${variantId} — set LEMONSQUEEZY_VARIANT_*`);
  if (!lemonSubId || !data.user_email) throw new Error('subscription event missing id or email');

  transaction(() => {
    const customer = entitlementRepo.upsertCustomerByLemon({
      email: data.user_email,
      name: data.user_name,
      lemon_customer_id: lemonCustomerId,
    });
    entitlementRepo.upsertSubscription({
      lemon_subscription_id: lemonSubId,
      customer_id: customer.id,
      plan_id: planId,
      status: data.status,
      renews_at: data.renews_at || null,
      ends_at: data.ends_at || null,
      trial_ends_at: data.trial_ends_at || null,
      update_payment_url: data.urls?.update_payment_method || null,
      raw_payload: JSON.stringify(payload),
    });
    // Entitlement attached to the license, not the subscription, in our
    // model — license event will land entitlement.status. Here we just
    // ensure subscription_id is current.
  });
}

function handleSubscriptionEnded(payload) {
  const lemonSubId = parseInt(payload?.data?.id, 10);
  const sub = entitlementRepo.findSubscriptionByLemonId(lemonSubId);
  if (!sub) return;  // never saw the subscription — nothing to disable

  // Find every license attached to this subscription and disable its entitlement.
  const licenses = db
    .prepare(`SELECT id FROM customer_licenses WHERE subscription_id = ?`)
    .all(sub.id);
  transaction(() => {
    handleSubscriptionUpsert(payload);  // updates status field
    for (const lic of licenses) {
      entitlementRepo.setEntitlementStatus(lic.id, 'disabled');
    }
  });
}

function handleLicenseUpsert(payload) {
  const data = payload?.data?.attributes || {};
  const lemonLicenseId = parseInt(payload?.data?.id, 10);
  const lemonCustomerId = data.customer_id;
  const licenseKey = data.key;  // LS sends the plaintext key in this event only
  if (!lemonLicenseId || !licenseKey) throw new Error('license_key event missing id or key');

  // Reverse-lookup plan via the order's variant_id (license_key events
  // carry the variant_id since LS API v1 2024-09).
  const variantId = data.variant_id;
  const planId = planIdFromVariantId(variantId);
  if (!planId) throw new Error(`Unknown LS variant_id ${variantId} on license event`);
  const plan = getPlan(planId);

  transaction(() => {
    const customer = entitlementRepo.upsertCustomerByLemon({
      email: data.user_email,
      name: data.user_name,
      lemon_customer_id: lemonCustomerId,
    });

    // Tie to subscription if known.
    const lemonSubId = data.subscription_id ? parseInt(data.subscription_id, 10) : null;
    const sub = lemonSubId ? entitlementRepo.findSubscriptionByLemonId(lemonSubId) : null;

    const license = entitlementRepo.upsertLicense({
      lemon_license_id: lemonLicenseId,
      customer_id: customer.id,
      subscription_id: sub?.id || null,
      license_key_hash: hashLicenseKey(licenseKey),
      license_key_short: shortLicenseKey(licenseKey),
      status: data.status || 'active',
      activation_limit: data.activation_limit || 1,
      instances_count: data.instances_count || 0,
      expires_at: data.expires_at || null,
    });

    entitlementRepo.upsertEntitlement({
      customer_id: customer.id,
      customer_license_id: license.id,
      plan_id: planId,
      feature_flags: Object.fromEntries(plan.features.map(f => [f, true])),
      quota: { tier: plan.tier, billing_cycle: plan.billing_cycle },
      status: license.status === 'active' ? 'active' : 'disabled',
    });
  });
}
