/**
 * citations controller — STUB for Phase 0.
 * Returns empty arrays so the dashboard renders cleanly.
 * Full implementation arrives in Phase 2 (see docs/CITATION-TRACKING-SPEC.md).
 *
 * Mounted at /api/v1/citations.
 */

import { Router } from 'express';
import { authPluginJwt } from '../_shared/plugin-auth.middleware.js';

const router = Router();

router.get('/', authPluginJwt, async (_req, res) => {
  return res.json({
    citations: [],
    total: 0,
    tier_required: 'pro',
    phase: 0,
    message: 'Citation tracking arrives in Phase 2.',
  });
});

router.post('/submit', authPluginJwt, async (_req, res) => {
  return res.status(501).json({
    error: {
      code:    'NOT_IMPLEMENTED',
      message: 'User-submitted citations arrive in Phase 2.',
    },
  });
});

export default router;
