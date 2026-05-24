/**
 * projects/projects.controller.js — HTTP layer (repository refactor).
 *
 * Pure routing/validation/audit. All business logic lives in projects.service.
 * All SQL lives in projects.repository / milestones.repository / gallery.repository.
 *
 * Three exported routers:
 *   - publicRouter  — /api/public/projects/*   (no auth, read-only)
 *   - adminRouter   — /api/admin/projects/*    (JWT, full CRUD)
 *   - legacyRouter  — /api/projects/*          (legacy compat, deprecated)
 */

import { Router } from 'express';

import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { env } from '../../../core/config/env.js';

import { projectsService } from './projects.service.js';
import {
  projectInputSchema,
  milestoneSchema,
  galleryItemSchema,
  projectIdParamSchema as idParam,
  projectSlugParamSchema as slugParam,
} from './projects.schema.js';

// ---- Pagination helper (single source of truth for clamping) ----
function readPagination(req) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

// =========================================================
// PUBLIC ROUTER — /api/public/projects
// =========================================================
export const publicRouter = Router();

publicRouter.get('/', asyncHandler((req, res) => {
  res.json(projectsService.list(req.tenantId, readPagination(req), env.UPLOAD_PUBLIC_URL));
}));

publicRouter.get('/:slug', validate({ params: slugParam }), asyncHandler((req, res) => {
  res.json(projectsService.getBySlug(req.tenantId, req.validated.params.slug, env.UPLOAD_PUBLIC_URL));
}));

publicRouter.get('/:id/milestones', validate({ params: idParam }), asyncHandler((req, res) => {
  res.json(projectsService.listMilestones(req.tenantId, req.validated.params.id, env.UPLOAD_PUBLIC_URL));
}));

publicRouter.get('/:id/gallery', validate({ params: idParam }), asyncHandler((req, res) => {
  res.json(projectsService.listGallery(req.tenantId, req.validated.params.id, env.UPLOAD_PUBLIC_URL));
}));

// =========================================================
// ADMIN ROUTER — /api/admin/projects
// =========================================================
export const adminRouter = Router();
adminRouter.use(requireAuth);

// ---- Milestone/gallery sub-routes MUST be declared before `/:id`
//      so Express does not interpret "milestones" or "gallery" as an :id. ----

adminRouter.patch('/milestones/:id',
  requireRole('admin', 'editor'),
  validate({ params: idParam, body: milestoneSchema.partial() }),
  asyncHandler((req, res) => {
    const updated = projectsService.updateMilestone(
      req.tenantId, req.validated.params.id, req.validated.body, env.UPLOAD_PUBLIC_URL
    );
    recordAudit(req, 'milestone.update', {
      entityType: 'milestone', entityId: req.validated.params.id,
    });
    res.json(updated);
  })
);

adminRouter.delete('/milestones/:id',
  requireRole('admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const result = projectsService.deleteMilestone(req.tenantId, req.validated.params.id);
    recordAudit(req, 'milestone.delete', {
      entityType: 'milestone', entityId: req.validated.params.id,
    });
    res.json(result);
  })
);

adminRouter.delete('/gallery/:id',
  requireRole('admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const result = projectsService.deleteGalleryItem(req.tenantId, req.validated.params.id);
    recordAudit(req, 'gallery.delete', {
      entityType: 'gallery_item', entityId: req.validated.params.id,
    });
    res.json(result);
  })
);

// ---- Main project routes ----

adminRouter.get('/', asyncHandler((req, res) => {
  res.json(projectsService.list(req.tenantId, readPagination(req), env.UPLOAD_PUBLIC_URL));
}));

adminRouter.get('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  res.json(projectsService.getById(req.tenantId, req.validated.params.id, env.UPLOAD_PUBLIC_URL));
}));

adminRouter.post('/:id/milestones',
  requireRole('admin', 'editor'),
  validate({ params: idParam, body: milestoneSchema }),
  asyncHandler((req, res) => {
    const created = projectsService.createMilestone(
      req.tenantId, req.validated.params.id, req.validated.body, env.UPLOAD_PUBLIC_URL
    );
    recordAudit(req, 'milestone.create', {
      entityType: 'milestone',
      entityId: created.id,
      metadata: { project_id: req.validated.params.id, title: created.title },
    });
    res.status(201).json(created);
  })
);

adminRouter.post('/:id/gallery',
  requireRole('admin', 'editor'),
  validate({ params: idParam, body: galleryItemSchema }),
  asyncHandler((req, res) => {
    const created = projectsService.createGalleryItem(
      req.tenantId, req.validated.params.id, req.validated.body, env.UPLOAD_PUBLIC_URL
    );
    recordAudit(req, 'gallery.create', {
      entityType: 'gallery_item',
      entityId: created.id,
      metadata: { project_id: req.validated.params.id, media_id: req.validated.body.media_id },
    });
    res.status(201).json(created);
  })
);

adminRouter.post('/',
  requireRole('admin', 'editor'),
  validate({ body: projectInputSchema }),
  asyncHandler((req, res) => {
    const created = projectsService.create(req.tenantId, req.validated.body, env.UPLOAD_PUBLIC_URL);
    recordAudit(req, 'project.create', {
      entityType: 'project', entityId: created.id, metadata: { name: created.name },
    });
    res.status(201).json(created);
  })
);

// PATCH + PUT share the same handler (PUT kept for legacy clients).
function handleUpdate(req, res) {
  const updated = projectsService.update(
    req.tenantId, req.validated.params.id, req.validated.body, env.UPLOAD_PUBLIC_URL
  );
  recordAudit(req, 'project.update', {
    entityType: 'project',
    entityId: req.validated.params.id,
    metadata: { changes: Object.keys(req.validated.body) },
  });
  res.json(updated);
}

adminRouter.patch('/:id',
  requireRole('admin', 'editor'),
  validate({ params: idParam, body: projectInputSchema }),
  asyncHandler(handleUpdate)
);

adminRouter.put('/:id',
  requireRole('admin', 'editor'),
  validate({ params: idParam, body: projectInputSchema }),
  asyncHandler(handleUpdate)
);

adminRouter.delete('/:id',
  requireRole('admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const result = projectsService.softDelete(req.tenantId, req.validated.params.id);
    recordAudit(req, 'project.delete', {
      entityType: 'project', entityId: req.validated.params.id, metadata: { soft: true },
    });
    res.json(result);
  })
);

adminRouter.post('/:id/restore',
  requireRole('admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const result = projectsService.restore(req.tenantId, req.validated.params.id);
    recordAudit(req, 'project.restore', {
      entityType: 'project', entityId: req.validated.params.id,
    });
    res.json(result);
  })
);

// =========================================================
// LEGACY ROUTER — /api/projects (legacy endpoint paths, deprecated)
// =========================================================
export const legacyRouter = Router();

legacyRouter.use((req, res, next) => {
  res.set('X-API-Deprecated', 'Use /api/public/projects or /api/admin/projects');
  next();
});

legacyRouter.get('/', asyncHandler((req, res) => {
  res.json(projectsService.list(req.tenantId, readPagination(req), env.UPLOAD_PUBLIC_URL));
}));

legacyRouter.get('/admin/by-id/:id',
  requireAuth,
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    res.json(projectsService.getById(req.tenantId, req.validated.params.id, env.UPLOAD_PUBLIC_URL));
  })
);

// Mount admin sub-routes (milestones, gallery, write ops)
legacyRouter.use(adminRouter);

// Public single by slug — last, so it doesn't shadow /admin/* paths above.
legacyRouter.get('/:slug', validate({ params: slugParam }), asyncHandler((req, res) => {
  res.json(projectsService.getBySlug(req.tenantId, req.validated.params.slug, env.UPLOAD_PUBLIC_URL));
}));

export default legacyRouter;
