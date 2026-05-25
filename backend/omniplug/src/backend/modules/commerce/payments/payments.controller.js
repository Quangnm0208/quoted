/**
 * Payments controller — vendor-agnostic checkout + webhook + plans.
 *
 * Routes mounted at:
 *   POST /api/payments/checkout                 — visitor selects plan → checkout URL
 *   GET  /api/products/plans                    — public plan catalogue (FE-safe)
 *   POST /api/payments/webhook/:vendor          — generic webhook receiver,
 *                                                  dispatches to providers[vendor]
 *
 * Webhook flow (same for every vendor):
 *   1. Look up provider by :vendor — 404 UNKNOWN_PROVIDER on miss.
 *   2. provider.verifyWebhookSignature(rawBody, headers) — 401 BAD_SIGNATURE on miss.
 *   3. JSON parse the body — 400 INVALID_JSON on miss.
 *   4. provider.parseEvent(json) → { event_id, event_name } — 400 INVALID_EVENT on miss.
 *   5. webhook_events INSERT OR IGNORE on event_id — duplicate → 200 ok+duplicate.
 *   6. provider.isSupportedEvent? — no → mark processed + 200 ignored.
 *   7. provider.handleEvent(event_name, json) — throw → mark failed + 200 ok:false.
 *   8. Mark processed + 200 ok:true.
 *
 * This file knows NOTHING about Lemon Squeezy specifically. Adding Stripe =
 * drop providers/stripe/index.js + register it; this file unchanged.
 */

import { Router } from 'express';
import { tryAcquire } from '../../../../core/lib/rateLimiterIp.js';
import { CheckoutRequest } from '../../_contracts/index.js';
import * as service from './payments.service.js';
import { getProvider } from '../providers/index.js';
import * as eventStore from './webhook-events.repository.js';

// ─── /api/payments ────────────────────────────────────────────────────
export const paymentsRouter = Router();

function checkoutRateLimit(req, res, next) {
  // Test mode skips the IP rate limit so CI can fire many calls from 127.0.0.1
  // without hitting 429. Production must not set this.
  if (process.env.LEMONSQUEEZY_TEST_MODE === 'true') return next();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (tryAcquire(ip, 10)) return next();
  return res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many checkout attempts. Try again in a minute.' },
  });
}

paymentsRouter.post('/checkout', checkoutRateLimit, async (req, res, next) => {
  try {
    const parsed = CheckoutRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Checkout payload invalid', details: parsed.error.flatten() },
      });
    }
    const result = await service.createCheckout(parsed.data);
    return res.status(200).json(result);
  } catch (e) {
    if (e.code) {
      return res.status(e.httpStatus || 400).json({
        error: { code: e.code, message: e.message },
      });
    }
    return next(e);
  }
});

// ─── /api/payments/webhook/:vendor ────────────────────────────────────
//
// raw-body parser is mounted at /api/payments/webhook/ in server.js — so
// req.body here is a Buffer. We extract :vendor from the URL, dispatch.
export const webhookRouter = Router();

webhookRouter.post('/:vendor', async (req, res) => {
  const vendor = String(req.params.vendor || '').toLowerCase();
  const provider = getProvider(vendor);
  if (!provider) {
    return res.status(404).json({
      error: { code: 'UNKNOWN_PROVIDER', message: `No payment provider registered for "${vendor}"` },
    });
  }

  const rawBody = req.body;  // Buffer
  if (!provider.verifyWebhookSignature(rawBody, req.headers)) {
    return res.status(401).json({
      error: { code: 'BAD_SIGNATURE', message: 'Signature mismatch' },
    });
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Webhook body not JSON' },
    });
  }

  const event = provider.parseEvent(payload);
  if (!event) {
    return res.status(400).json({
      error: { code: 'INVALID_EVENT', message: 'Provider could not parse the event' },
    });
  }

  const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const { isNew } = eventStore.recordEventIfNew({
    eventId: `${vendor}:${event.event_id}`,  // namespace event_id by vendor so two providers can share UUID space
    eventName: event.event_name,
    signatureValid: true,
    rawPayload: rawStr,
  });
  if (!isNew) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  if (provider.isSupportedEvent && !provider.isSupportedEvent(event.event_name)) {
    eventStore.markProcessed(`${vendor}:${event.event_id}`);
    return res.status(200).json({ ok: true, ignored: event.event_name });
  }

  try {
    await provider.handleEvent(event.event_name, payload);
    eventStore.markProcessed(`${vendor}:${event.event_id}`);
    return res.status(200).json({ ok: true, event_name: event.event_name });
  } catch (e) {
    eventStore.markFailed(`${vendor}:${event.event_id}`, e.message);
    console.error(`[webhook/${vendor}] handler failed for ${event.event_name}:`, e);
    return res.status(200).json({ ok: false, event_name: event.event_name, error: e.message });
  }
});

// ─── /api/products/plans ──────────────────────────────────────────────
export const productsRouter = Router();

productsRouter.get('/plans', (_req, res) => {
  res.json({ plans: service.listPublicPlans() });
});
