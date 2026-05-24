/**
 * wp-sites controller — WP plugin registration + token management.
 *
 * Mounted at /api/v1/wp-sites and /api/v1/dashboard.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authPluginJwt } from './plugin-auth.middleware.js';
import * as service from './wp-sites.service.js';

const router = Router();

const registerSchema = z.object({
  license_key:    z.string().min(20).max(8200),
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

function sendError(res, next, err) {
  if (err && err.code) {
    return res.status(err.httpStatus || 400).json({
      error: { code: err.code, message: err.message, details: err.details || null },
    });
  }
  return next(err);
}

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
    return sendError(res, next, err);
  }
});

router.post('/refresh-token', authPluginJwt, async (req, res, next) => {
  try {
    const result = await service.refreshToken(req.auth.tenantId, req.auth.wpSiteId);
    return res.json(result);
  } catch (err) {
    return sendError(res, next, err);
  }
});

router.post('/posts/sync', authPluginJwt, async (req, res, next) => {
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
      parsed.data.posts,
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;

// Separate router for /api/v1/dashboard (mounted explicitly in server.js).
export const dashboardRouter = Router();
dashboardRouter.get('/summary', authPluginJwt, async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
    const summary = await service.getDashboardSummary(req.auth.tenantId, days);
    return res.json(summary);
  } catch (err) {
    return next(err);
  }
});
