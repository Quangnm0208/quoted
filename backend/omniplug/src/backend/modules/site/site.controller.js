/**
 * site/site.controller.js — Site Config per tenant (v1.4.4).
 *
 * Properties:
 *   - All queries scoped by tenant_id
 *   - Exports publicRouter + adminRouter + legacy default
 */

import { Router } from 'express';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError, ValidationError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { siteService } from './site.service.js';

// =========================================================
// PUBLIC ROUTER — /api/public/site
// =========================================================
export const publicRouter = Router();
publicRouter.get('/', asyncHandler((req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(siteService.getPublicMap(req.tenantId));
}));

// =========================================================
// ADMIN ROUTER — /api/admin/site
// =========================================================
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get('/', asyncHandler((req, res) => {
  res.json(siteService.getAdminList(req.tenantId));
}));

adminRouter.get('/:key', asyncHandler((req, res) => {
  const item = siteService.getOne(req.tenantId, req.params.key);
  if (!item) throw new NotFoundError('Key not found', 'KEY_NOT_FOUND');
  res.json(item);
}));

adminRouter.put('/:key', requireRole('admin'), asyncHandler((req, res) => {
  const { value, label, description } = req.body || {};
  if (value === undefined) throw new ValidationError('value is required');
  const updated = siteService.upsert(
    req.tenantId, req.params.key, value, req.user.id, label, description
  );
  recordAudit(req, 'site.config.update', {
    entityType: 'site_config',
    metadata: { key: req.params.key },
  });
  res.json(updated);
}));

// =========================================================
// LEGACY — /api/site
// =========================================================
export const legacyRouter = Router();
legacyRouter.use((req, res, next) => {
  res.set('X-API-Deprecated', 'Use /api/public/site or /api/admin/site');
  next();
});

legacyRouter.get('/', asyncHandler((req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(siteService.getPublicMap(req.tenantId));
}));
legacyRouter.use('/admin', adminRouter);

export default legacyRouter;
