/**
 * indexing/indexing.controller.js — HTTP layer for IndexNow.
 *
 * Three routers:
 *
 *   rootRouter   — mounted at server root, tenant resolved by Host.
 *                  Serves the IndexNow key verification file:
 *                    GET /<key>.txt
 *                  Bing fetches this URL before accepting submissions.
 *                  Returning 404 here means submissions silently fail.
 *
 *   adminRouter  — mounted at /api/admin/indexing.
 *                  Admin can view recent submissions and manually push.
 *
 * The rootRouter route is unusual — it matches any `/{32 hex chars}.txt`.
 * We do NOT want it to match other .txt files (robots.txt is handled by
 * the seo module). Strict regex on the path prevents collision.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { ValidationError } from '../../../core/lib/errors.js';
import { indexingService } from './indexing.service.js';

// =====================================================================
// Root router — IndexNow key verification file
// =====================================================================
//
// Match pattern: /{32-hex-chars}.txt
// Express route patterns do not support full regex; we use a callback
// match with strict validation inside.

export const rootRouter = Router();

const KEY_FILE_REGEX = /^([a-f0-9]{16,128})\.txt$/i;

rootRouter.get('/:keyfile', asyncHandler((req, res, next) => {
  const match = KEY_FILE_REGEX.exec(req.params.keyfile);
  if (!match) return next(); // not a key file pattern, let other routes try

  const requestedKey = match[1];
  const ownedKey = indexingService.getKeyForVerification(req.tenantId);

  if (requestedKey !== ownedKey) {
    // Wrong key for this tenant. 404 (not 403) to avoid leaking key existence.
    return res.status(404).type('text/plain').send('Not found');
  }

  // Bing requires the file body to contain the key as plain text.
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, s-maxage=86400, max-age=3600');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.send(ownedKey);
}));

// =====================================================================
// Admin router — manual submit + recent submissions list
// =====================================================================

export const adminRouter = Router();
adminRouter.use(requireAuth);

/**
 * GET /api/admin/indexing/log
 * Returns recent submissions for the authenticated tenant.
 */
adminRouter.get('/log',
  requireRole('admin', 'editor', 'platform_admin'),
  asyncHandler((req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    res.json(indexingService.listRecentSubmissions(req.tenantId, limit, offset));
  }),
);

/**
 * POST /api/admin/indexing/submit
 * Body: { urls: string[] } — absolute URLs to submit
 *
 * Used by the "Resubmit" button in the admin UI. Bypasses throttle.
 *
 * Why admin only (not editor): submitting fake URLs in bulk could waste
 * the tenant's IndexNow quota or trigger a Bing ban. Gate behind admin.
 */
adminRouter.post('/submit',
  requireRole('admin', 'platform_admin'),
  asyncHandler(async (req, res) => {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : null;
    if (!urls || urls.length === 0) {
      throw new ValidationError('urls (non-empty array) required');
    }
    if (urls.length > 100) {
      throw new ValidationError('Maximum 100 URLs per submission');
    }
    // Validate every URL is absolute HTTPS — IndexNow rejects others.
    for (const u of urls) {
      if (typeof u !== 'string' || !u.startsWith('https://')) {
        throw new ValidationError('All URLs must be absolute https:// URLs');
      }
    }

    // host derivation: take from first URL (assume all share the same host).
    const host = new URL(urls[0]).host;

    const result = await indexingService.submit({
      tenantId: req.tenantId,
      host,
      urls,
      manual: true,
    });

    recordAudit(req, 'indexing.submit_manual', {
      entityType: 'indexing',
      metadata: { urls: urls.length, submitted: result.submitted, ok: result.ok },
    });

    res.json(result);
  }),
);
