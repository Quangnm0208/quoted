/**
 * citations controller — STUB for Phase 0.
 *
 * Returns empty arrays so dashboard renders cleanly.
 * Full implementation arrives in Phase 2 (Month 5-6).
 * See docs/CITATION-TRACKING-SPEC.md.
 *
 * @module citations/controller
 */

import { Router } from 'express';
import { authJwt } from '../../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/citations
 * Returns empty list until Phase 2 ships.
 */
router.get('/', authJwt, async (req, res) => {
  return res.json({
    citations: [],
    total: 0,
    tier_required: 'pro',
    phase: 0,
    message: 'Citation tracking arrives in Phase 2.',
  });
});

/**
 * POST /api/v1/citations/submit
 * User-submitted citations (Phase 2 feature).
 */
router.post('/submit', authJwt, async (req, res) => {
  return res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'User-submitted citations arrive in Phase 2.',
    },
  });
});

export default router;
