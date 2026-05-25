/**
 * Licenses controller — plugin-facing.
 *
 * Routes mounted at /api/v1/licenses (BEFORE the requireApiKey gate on
 * /api/v1 — the plugin authenticates with the activation_token, not an
 * op_live_* API key).
 */

import { Router } from 'express';
import { z } from 'zod';
import { tryAcquire } from '../../../core/lib/rateLimiterIp.js';
import * as service from './licenses.service.js';

const router = Router();

const activateSchema = z.object({
  license_key:    z.string().min(8).max(64),
  site_url:       z.string().url().max(2048),
  plugin_version: z.string().max(20).optional(),
  wp_version:     z.string().max(20).optional(),
});

const tokenBodySchema = z.object({
  site_url:    z.string().url().max(2048),
  license_key: z.string().min(8).max(64).optional(),  // optional on deactivate (graceful when key forgotten)
});

function activateRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (tryAcquire(ip, 5)) return next();
  return res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many activation attempts. Try again in a minute.' },
  });
}

function sendError(res, next, err) {
  if (err && err.code) {
    return res.status(err.httpStatus || 400).json({
      error: { code: err.code, message: err.message, details: err.details || null },
    });
  }
  return next(err);
}

function requireToken(req, res) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'TOKEN_MISSING', message: 'Authorization: Bearer <activation_token>' } });
    return null;
  }
  return header.slice(7).trim();
}

router.post('/activate', activateRateLimit, async (req, res, next) => {
  try {
    const parsed = activateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Activation payload invalid', details: parsed.error.flatten() },
      });
    }
    const result = await service.activate(parsed.data);
    return res.status(201).json(result);
  } catch (e) {
    return sendError(res, next, e);
  }
});

router.post('/validate', (req, res, next) => {
  try {
    const token = requireToken(req, res);
    if (!token) return;
    const parsed = tokenBodySchema.pick({ site_url: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Validate payload invalid', details: parsed.error.flatten() },
      });
    }
    const result = service.validate({ token, site_url: parsed.data.site_url });
    return res.status(200).json(result);
  } catch (e) {
    return sendError(res, next, e);
  }
});

router.post('/deactivate', async (req, res, next) => {
  try {
    const token = requireToken(req, res);
    if (!token) return;
    const parsed = tokenBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Deactivate payload invalid', details: parsed.error.flatten() },
      });
    }
    const result = await service.deactivate({
      token,
      site_url: parsed.data.site_url,
      license_key: parsed.data.license_key,
    });
    return res.status(200).json(result);
  } catch (e) {
    return sendError(res, next, e);
  }
});

export default router;
