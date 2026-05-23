/**
 * live-ai-test controller — STUB for Phase 0.
 *
 * Returns 501 Not Implemented. Full implementation in Phase 1.
 * See docs/PHASE-0-BUILD-PLAN.md for Phase 1 build details.
 *
 * Production design (Phase 1):
 *  POST /api/v1/live-test/query
 *  - Streams Perplexity Sonar response via SSE
 *  - Highlights citations of tenant's own domain
 *  - Free tier: 3/month, Pro: 100/month soft cap
 *  - Cost: ~$0.01/query
 *
 * @module live-ai-test/controller
 */

import { Router } from 'express';
import { authJwt } from '../../middleware/auth.js';

const router = Router();

/**
 * POST /api/v1/live-test/query
 */
router.post('/query', authJwt, async (req, res) => {
  return res.status(501).json({
    error: {
      code:    'NOT_IMPLEMENTED',
      message: 'Live AI Test arrives in Phase 1 (Month 3-4).',
      phase:   1,
    },
  });
});

/**
 * GET /api/v1/live-test/quota
 * Returns current usage. Stub returns 0/3 for free.
 */
router.get('/quota', authJwt, async (req, res) => {
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
