/**
 * articles/articles.controller.js — HTTP layer (v1.4.4).
 *
 * Design notes:
 *   - Exports 2 routers: publicRouter + adminRouter
 *   - Tenant scoping: passes req.tenantId xuống service
 *   - Policy lookup từ articles.policy.js
 *   - Schemas từ articles.schema.js
 *
 * Public routes (no auth, mounted at /api/public/articles):
 *   GET    /                  — list published
 *   GET    /:slug             — single published
 *
 * Admin routes (JWT, mounted at /api/admin/articles):
 *   GET    /                  — list all (filterable)
 *   GET    /:id               — read full (drafts visible)
 *   POST   /                  — create
 *   PATCH  /:id               — partial update
 *   PUT    /:id               — alias for PATCH
 *   POST   /:id/publish
 *   POST   /:id/archive
 *   DELETE /:id               — soft delete (admin only)
 *   POST   /:id/restore       — (admin only)
 */

import { Router } from 'express';
import { articlesService } from './articles.service.js';
import { articlesPolicy } from './articles.policy.js';
import { articleInputSchema, articleListQuerySchema, articleIdParamSchema, articleSlugParamSchema, articleScheduleSchema } from './articles.schema.js';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { env } from '../../../core/config/env.js';

// =========================================================
// PUBLIC ROUTER — /api/public/articles
// =========================================================
export const publicRouter = Router();

publicRouter.get('/',
  validate({ query: articleListQuerySchema }),
  asyncHandler((req, res) => {
    // v0.7.0: publicMode pulls published + scheduled-but-past articles
    // in a single query. Drafts/archived/scheduled-future never appear.
    const query = {
      ...req.validated.query,
      publicMode: true,
      status: undefined,
      includeDeleted: false,
    };
    const result = articlesService.list(query, req.tenantId, env.UPLOAD_PUBLIC_URL);
    res.json(result);
  })
);

publicRouter.get('/:slug',
  validate({ params: articleSlugParamSchema }),
  asyncHandler((req, res) => {
    res.json(articlesService.getPublishedBySlug(
      req.validated.params.slug, req.tenantId, env.UPLOAD_PUBLIC_URL
    ));
  })
);

// =========================================================
// ADMIN ROUTER — /api/admin/articles
// =========================================================
export const adminRouter = Router();
adminRouter.use(requireAuth);   // toàn bộ admin routes cần JWT

adminRouter.get('/',
  requireRole(...articlesPolicy.list),
  validate({ query: articleListQuerySchema }),
  asyncHandler((req, res) => {
    const q = req.validated.query;
    const result = articlesService.list({
      ...q,
      includeDeleted: !!q.include_deleted,
    }, req.tenantId, env.UPLOAD_PUBLIC_URL);
    res.json(result);
  })
);

adminRouter.get('/:id',
  requireRole(...articlesPolicy.read),
  validate({ params: articleIdParamSchema }),
  asyncHandler((req, res) => {
    res.json(articlesService.getById(
      req.validated.params.id, req.tenantId, env.UPLOAD_PUBLIC_URL
    ));
  })
);

adminRouter.post('/',
  requireRole(...articlesPolicy.create),
  validate({ body: articleInputSchema }),
  asyncHandler((req, res) => {
    const article = articlesService.create(
      req.validated.body, req.user.id, req.tenantId, env.UPLOAD_PUBLIC_URL
    );
    recordAudit(req, 'article.create', {
      entityType: 'article',
      entityId: article.id,
      metadata: { title: article.title, status: article.status, tenant_id: req.tenantId },
    });
    res.status(201).json(article);
  })
);

const updateHandler = asyncHandler((req, res) => {
  const article = articlesService.update(
    req.validated.params.id, req.validated.body, req.tenantId, env.UPLOAD_PUBLIC_URL
  );
  recordAudit(req, 'article.update', {
    entityType: 'article',
    entityId: req.validated.params.id,
    metadata: { changes: Object.keys(req.validated.body) },
  });
  res.json(article);
});

adminRouter.patch('/:id',
  requireRole(...articlesPolicy.update),
  validate({ params: articleIdParamSchema, body: articleInputSchema }),
  updateHandler
);

adminRouter.put('/:id',
  requireRole(...articlesPolicy.update),
  validate({ params: articleIdParamSchema, body: articleInputSchema }),
  updateHandler
);

adminRouter.post('/:id/publish',
  requireRole(...articlesPolicy.publish),
  validate({ params: articleIdParamSchema }),
  asyncHandler((req, res) => {
    const article = articlesService.publish(req.validated.params.id, req.tenantId, env.UPLOAD_PUBLIC_URL);
    recordAudit(req, 'article.publish', { entityType: 'article', entityId: req.validated.params.id });
    res.json(article);
  })
);

// v0.7.0 — schedule a draft to auto-publish at a future ISO datetime.
adminRouter.post('/:id/schedule',
  requireRole(...articlesPolicy.publish),
  validate({ params: articleIdParamSchema, body: articleScheduleSchema }),
  asyncHandler((req, res) => {
    const article = articlesService.schedule(
      req.validated.params.id,
      req.validated.body.scheduled_at,
      req.tenantId,
      env.UPLOAD_PUBLIC_URL,
    );
    recordAudit(req, 'article.schedule', {
      entityType: 'article',
      entityId: req.validated.params.id,
      metadata: { scheduled_at: req.validated.body.scheduled_at },
    });
    res.json(article);
  })
);

// v0.7.0 — revert a published article back to draft.
adminRouter.post('/:id/unpublish',
  requireRole(...articlesPolicy.publish),
  validate({ params: articleIdParamSchema }),
  asyncHandler((req, res) => {
    const article = articlesService.unpublish(req.validated.params.id, req.tenantId, env.UPLOAD_PUBLIC_URL);
    recordAudit(req, 'article.unpublish', { entityType: 'article', entityId: req.validated.params.id });
    res.json(article);
  })
);

adminRouter.post('/:id/archive',
  requireRole(...articlesPolicy.archive),
  validate({ params: articleIdParamSchema }),
  asyncHandler((req, res) => {
    const article = articlesService.archive(req.validated.params.id, req.tenantId, env.UPLOAD_PUBLIC_URL);
    recordAudit(req, 'article.archive', { entityType: 'article', entityId: req.validated.params.id });
    res.json(article);
  })
);

adminRouter.delete('/:id',
  requireRole(...articlesPolicy.delete),
  validate({ params: articleIdParamSchema }),
  asyncHandler((req, res) => {
    const result = articlesService.softDelete(req.validated.params.id, req.tenantId);
    recordAudit(req, 'article.delete', {
      entityType: 'article', entityId: req.validated.params.id, metadata: { soft: true },
    });
    res.json(result);
  })
);

adminRouter.post('/:id/restore',
  requireRole(...articlesPolicy.restore),
  validate({ params: articleIdParamSchema }),
  asyncHandler((req, res) => {
    const result = articlesService.restore(req.validated.params.id, req.tenantId);
    recordAudit(req, 'article.restore', { entityType: 'article', entityId: req.validated.params.id });
    res.json(result);
  })
);

// =========================================================
// LEGACY ROUTER — backward compat cho legacy clients
// =========================================================
// /api/articles vẫn work, route public GET + admin auth-required.
// Sẽ deprecate trong previous release.
export const legacyRouter = Router();
legacyRouter.use((req, res, next) => {
  res.set('X-API-Deprecated', 'Use /api/public/articles or /api/admin/articles');
  next();
});

// Public endpoints under legacy
legacyRouter.get('/', validate({ query: articleListQuerySchema }), asyncHandler((req, res) => {
  const query = { ...req.validated.query, status: 'published', includeDeleted: false };
  res.json(articlesService.list(query, req.tenantId, env.UPLOAD_PUBLIC_URL));
}));
legacyRouter.get('/:slug', asyncHandler((req, res) => {
  // backward compat: /api/articles/:slug = public
  res.json(articlesService.getPublishedBySlug(req.params.slug, req.tenantId, env.UPLOAD_PUBLIC_URL));
}));

// Default export — legacy router cho server.js cũ tham chiếu
export default legacyRouter;
