/**
 * wp-sites controller — WP plugin registration + token management.
 *
 * Routes mounted at /api/v1/wp-sites
 *
 * @module wp-sites/controller
 */

import { Router } from 'express';
import { z } from 'zod';
import { authJwt } from '../../middleware/auth.js';
import * as service from './wp-sites.service.js';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────

const registerSchema = z.object({
  license_key:    z.string().min(20).max(200),
  domain:         z.string().min(3).max(253),
  wp_version:     z.string().max(20).optional(),
  plugin_version: z.string().max(20).optional(),
  site_name:      z.string().max(200).optional(),
  admin_email:    z.string().email().max(254).optional(),
});

const postSyncSchema = z.object({
  posts: z.array(z.object({
    wp_post_id:    z.number().int().positive(),
    slug:          z.string().min(1).max(200),
    title:         z.string().max(500),
    excerpt:       z.string().max(2000).optional(),
    content_html:  z.string().max(500000),
    author:        z.string().max(200).optional(),
    categories:    z.array(z.string()).max(50).optional(),
    tags:          z.array(z.string()).max(100).optional(),
    published_at:  z.string(),
    modified_at:   z.string(),
    url:           z.string().url(),
  })).min(1).max(100),
});

// ─── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/wp-sites/register
 * Public (no JWT). Verifies license + creates JWT.
 */
router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code:    'INVALID_REQUEST',
          message: 'Request body validation failed',
          details: parsed.error.flatten(),
        },
      });
    }

    const result = await service.register(parsed.data);
    return res.status(201).json(result);
  } catch (err) {
    if (err.code) {
      return res.status(err.httpStatus || 400).json({
        error: {
          code:    err.code,
          message: err.message,
          details: err.details || null,
        },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/wp-sites/refresh-token
 * Authenticated. Renews JWT.
 */
router.post('/refresh-token', authJwt, async (req, res, next) => {
  try {
    const result = await service.refreshToken(req.auth.tenantId, req.auth.wpSiteId);
    return res.json(result);
  } catch (err) {
    if (err.code) {
      return res.status(err.httpStatus || 400).json({
        error: { code: err.code, message: err.message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/wp-sites/posts/sync
 * Authenticated. Plugin syncs post metadata.
 */
router.post('/posts/sync', authJwt, async (req, res, next) => {
  try {
    const parsed = postSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code:    'INVALID_REQUEST',
          message: 'Post sync validation failed',
          details: parsed.error.flatten(),
        },
      });
    }

    const result = await service.syncPosts(
      req.auth.tenantId,
      req.auth.wpSiteId,
      parsed.data.posts
    );
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/dashboard/summary
 * Mounted via wp-sites for plan visibility.
 * NOTE: Dashboard summary aggregates bot_crawls + citations. Implementation
 * lives here for Phase 0; consider extracting to dashboard module in Phase 1.
 */
router.get('/dashboard/summary', authJwt, async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
    const summary = await service.getDashboardSummary(req.auth.tenantId, days);
    return res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
