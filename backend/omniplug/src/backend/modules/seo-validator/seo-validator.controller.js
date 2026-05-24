/**
 * seo-validator/seo-validator.controller.js — Admin endpoints to preview
 * SEO score without persisting. The publish-time enforcement is wired
 * directly into article/project services, not exposed as a separate
 * endpoint.
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { seoValidatorService } from './seo-validator.service.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

adminRouter.get('/article/:id/score',
  requireRole('admin', 'editor', 'platform_admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const result = seoValidatorService.scoreArticle(req.tenantId, req.validated.params.id);
    res.json(result);
  }),
);

adminRouter.get('/project/:id/score',
  requireRole('admin', 'editor', 'platform_admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const result = seoValidatorService.scoreProject(req.tenantId, req.validated.params.id);
    res.json(result);
  }),
);
