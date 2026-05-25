/**
 * bot-crawls controller — ingestion endpoint for the Quoted WP plugin.
 * Mounted at /api/v1/bot-crawls.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authPluginJwt } from '../_shared/plugin-auth.middleware.js';
import * as service from './bot-crawls.service.js';

const router = Router();

const BOT_ALLOWLIST = new Set([
  'ClaudeBot', 'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'PerplexityBot', 'Perplexity-User', 'GoogleExtended',
  'Applebot-Extended', 'Bytespider', 'FacebookBot',
  'CCBot', 'DiffBot', 'Cohere', 'YouBot',
]);

const eventSchema = z.object({
  bot_name:    z.string().refine(v => BOT_ALLOWLIST.has(v), { message: 'Unknown bot name' }),
  url_path:    z.string().min(1).max(2048).startsWith('/'),
  user_agent:  z.string().max(512).optional(),
  ip_hash:     z.string().regex(/^sha256:[a-f0-9]{64}$/),
  crawled_at:  z.string().datetime(),
});

const batchSchema = z.object({
  batch_id: z.string().min(1).max(64).optional(),
  events:   z.array(eventSchema).min(1).max(500),
});

router.post('/batch', authPluginJwt, async (req, res, next) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code:    'INVALID_BATCH',
          message: 'Batch validation failed',
          details: parsed.error.flatten(),
        },
      });
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400 * 1000;
    const validEvents = parsed.data.events.filter(e => {
      const t = new Date(e.crawled_at).getTime();
      return t > sevenDaysAgo && t < now + 300000;
    });

    if (validEvents.length === 0) {
      return res.status(400).json({
        error: { code: 'NO_VALID_EVENTS', message: 'No events in the accepted time window.' },
      });
    }

    const result = await service.ingestBatch(
      req.auth.tenantId,
      req.auth.wpSiteId,
      validEvents,
    );
    return res.status(202).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
