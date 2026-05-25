/**
 * live-ai-test controller — real implementation as of v0.4.1.
 *
 * Mounted at /api/v1/live-test.
 *
 *   POST /query   { prompt }  →  { answer, citations[], tokens_used, quota }
 *                 402 QUOTA_EXCEEDED if monthly cap hit
 *                 503 PROVIDER_NOT_CONFIGURED if PERPLEXITY_API_KEY missing
 *   GET  /quota               →  { used_this_month, limit, remaining, resets_at }
 *
 * Rate-limited 10/hour/IP — cost protection on top of monthly quota.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authPluginJwt } from '../_shared/plugin-auth.middleware.js';
import { tryAcquire } from '../../../../core/lib/rateLimiterIp.js';
import * as service from './live-ai-test.service.js';

const router = Router();

const querySchema = z.object({
  prompt: z.string().min(3).max(2000),
});

function queryRateLimit(req, res, next) {
  if (process.env.LIVE_AI_TEST_MODE === 'true') return next();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  // 10/min burst is fine — the monthly quota does the real cost protection.
  if (tryAcquire(ip, 10)) return next();
  return res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many Live AI Test calls. Slow down.' },
  });
}

function sendError(res, next, e) {
  if (e && e.code) {
    return res.status(e.httpStatus || 400).json({
      error: { code: e.code, message: e.message, details: e.details || null },
    });
  }
  return next(e);
}

router.post('/query', authPluginJwt, queryRateLimit, async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Invalid prompt', details: parsed.error.flatten() },
      });
    }
    const out = await service.runQuery({
      tenantId: req.auth.tenantId,
      plan:     req.auth.plan,
      prompt:   parsed.data.prompt,
    });
    res.json(out);
  } catch (e) { return sendError(res, next, e); }
});

router.get('/quota', authPluginJwt, (req, res, next) => {
  try {
    res.json(service.quotaFor({ tenantId: req.auth.tenantId, plan: req.auth.plan }));
  } catch (e) { return sendError(res, next, e); }
});

export default router;
