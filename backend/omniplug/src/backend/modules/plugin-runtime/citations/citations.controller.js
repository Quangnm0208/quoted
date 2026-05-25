/**
 * citations controller — real implementation as of v0.4.1.
 *
 * Mounted at /api/v1/citations.
 *
 *   GET  /                  list citations for the authenticated tenant
 *                           ?source=perplexity|tavily|serper|user_submitted
 *                           ?status=active|lost
 *                           ?min_confidence=0.85
 *                           ?since=2026-05-01T00:00:00Z
 *                           ?limit=50&offset=0
 *   POST /submit            user-curated single citation
 *   POST /sync              run all configured providers against [queries]
 *   GET  /summary           verified + likely counts for last N days
 */

import { Router } from 'express';
import { z } from 'zod';
import { authPluginJwt } from '../_shared/plugin-auth.middleware.js';
import * as service from './citations.service.js';

const router = Router();

const submitSchema = z.object({
  source:           z.string().min(1).max(64).optional(),
  query:            z.string().min(1).max(1000),
  cited_url:        z.string().url().max(2048),
  response_excerpt: z.string().max(2000).optional(),
  confidence:       z.number().min(0).max(1).optional(),
});

const syncSchema = z.object({
  queries: z.array(z.string().min(1).max(1000)).min(1).max(20),
});

const listQuerySchema = z.object({
  source:         z.enum(['perplexity', 'tavily', 'serper', 'user_submitted', 'live_ai_test']).optional(),
  status:         z.enum(['active', 'lost']).optional(),
  min_confidence: z.coerce.number().min(0).max(1).optional(),
  since:          z.string().datetime().optional(),
  limit:          z.coerce.number().int().min(1).max(200).default(50),
  offset:         z.coerce.number().int().min(0).default(0),
});

function sendError(res, next, e) {
  if (e && e.code) {
    return res.status(e.httpStatus || 400).json({
      error: { code: e.code, message: e.message, details: e.details || null },
    });
  }
  return next(e);
}

router.get('/', authPluginJwt, (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Invalid query', details: parsed.error.flatten() },
      });
    }
    const { rows, total, limit, offset } = service.listForTenant(req.auth.tenantId, {
      source:        parsed.data.source,
      status:        parsed.data.status,
      minConfidence: parsed.data.min_confidence,
      since:         parsed.data.since,
      limit:         parsed.data.limit,
      offset:        parsed.data.offset,
    });
    res.json({ citations: rows, total, limit, offset });
  } catch (e) { return sendError(res, next, e); }
});

router.get('/summary', authPluginJwt, (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    res.json(service.summary(req.auth.tenantId, days));
  } catch (e) { return sendError(res, next, e); }
});

router.post('/submit', authPluginJwt, (req, res, next) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Invalid submission', details: parsed.error.flatten() },
      });
    }
    res.status(201).json(service.submitOne(req.auth.tenantId, parsed.data));
  } catch (e) { return sendError(res, next, e); }
});

router.post('/sync', authPluginJwt, async (req, res, next) => {
  try {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Invalid sync body', details: parsed.error.flatten() },
      });
    }
    const out = await service.syncQueries(req.auth.tenantId, parsed.data.queries);
    res.json(out);
  } catch (e) { return sendError(res, next, e); }
});

export default router;
