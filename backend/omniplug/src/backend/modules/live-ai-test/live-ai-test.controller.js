/**
 * live-ai-test controller — STUB for Phase 0.
 * Returns 501. Full Perplexity proxy ships in Phase 1.
 *
 * Mounted at /api/v1/live-test.
 */

import { Router } from 'express';
import { authPluginJwt } from '../wp-sites/plugin-auth.middleware.js';

const router = Router();

router.post('/query', authPluginJwt, async (_req, res) => {
  return res.status(501).json({
    error: {
      code:    'NOT_IMPLEMENTED',
      message: 'Live AI Test arrives in Phase 1 (Month 3-4).',
      phase:   1,
    },
  });
});

router.get('/quota', authPluginJwt, async (req, res) => {
  return res.json({
    used_this_month: 0,
    limit:           req.auth.plan === 'free' ? 3 : 100,
    resets_at:       firstOfNextMonth(),
  });
});

function firstOfNextMonth() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export default router;
