/**
 * Payments controller.
 *
 * Routes mounted at:
 *   POST /api/payments/checkout                 — visitor selects plan → checkout URL
 *   GET  /api/products/plans                    — public plan catalogue (FE-safe)
 *   POST /api/payments/webhook/lemon-squeezy    — LS server-to-server hook
 *
 * The webhook route requires the RAW request body for HMAC verification.
 * Mounting order in server.js handles that — see comments there.
 */

import { Router } from 'express';
import { z } from 'zod';
import { tryAcquire } from '../../../core/lib/rateLimiterIp.js';
import * as service from './payments.service.js';
import { handleWebhook } from './webhook.handlers.js';

// ─── /api/payments ────────────────────────────────────────────────────
export const paymentsRouter = Router();

const checkoutSchema = z.object({
  plan: z.string().min(1).max(64),
  email: z.string().email().max(254).optional(),
});

function checkoutRateLimit(req, res, next) {
  // Pre-purchase endpoint — fairly liberal (10/min/IP).
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (tryAcquire(ip, 10)) return next();
  return res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many checkout attempts. Try again in a minute.' },
  });
}

paymentsRouter.post('/checkout', checkoutRateLimit, (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Checkout payload invalid', details: parsed.error.flatten() },
      });
    }
    const result = service.createCheckout(parsed.data);
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

// ─── /api/payments/webhook/lemon-squeezy ──────────────────────────────
//
// Receives raw body via express.raw({type: '*/*'}) mounted upstream of
// this router. The handler verifies HMAC + persists the event + processes
// idempotently. Returns 200 quickly even on duplicates so LS stops retrying.
export const webhookRouter = Router();

webhookRouter.post('/', async (req, res) => {
  try {
    const rawBody = req.body;  // Buffer (because express.raw)
    const signature = req.headers['x-signature'];
    const result = await handleWebhook(rawBody, signature);
    return res.status(result.httpStatus).json(result.body);
  } catch (e) {
    // Webhook handlers swallow their own errors; this is a last-ditch catch.
    console.error('[webhook] unhandled:', e);
    return res.status(500).json({ error: { code: 'WEBHOOK_FAILED', message: 'Internal error' } });
  }
});

// ─── /api/products/plans ──────────────────────────────────────────────
export const productsRouter = Router();

productsRouter.get('/plans', (_req, res) => {
  res.json({ plans: service.listPublicPlans() });
});
