/**
 * media/media.controller.js — HTTP layer for image upload + serve.
 *
 * Structure:
 *   - All handlers defined ONCE as named members of `handlers` (lower).
 *   - Each router (adminRouter, legacyRouter) MOUNTS the same handler at
 *     its own path with its own middleware stack.
 *   - No `legacyRouter.use('/admin', adminRouter)` shadow-path pattern;
 *     legacy paths explicitly attach the same handlers with the sunset
 *     middleware so they will be removed automatically on the sunset date.
 *
 * Why this matters:
 *   Before, fixing a bug in adminRouter could silently fix or break legacy
 *   without anyone noticing, because both URLs hit the same Router instance.
 *   Now: each path is an explicit mount of a handler. Diverge if needed
 *   (different rate limits, different middleware) without touching the others.
 */

import { Router } from 'express';
import multer from 'multer';

import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { sunset } from '../../../core/middleware/sunset.js';
import { asyncHandler, HttpError } from '../../../core/lib/asyncHandler.js';
import { ValidationError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { checkGenericLimit } from '../../../core/lib/rateLimit.js';
import { env } from '../../../core/config/env.js';

import { mediaService } from './media.service.js';

const UPLOAD_RATE_LIMIT_PER_HOUR = 30;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Sunset date for /api/media/* paths. After this, legacy returns 410 Gone.
// Communicate to clients via Sunset / Deprecation headers from day one.
const LEGACY_SUNSET_DATE = '2026-09-01';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_SIZE },
  fileFilter(req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Unsupported MIME header: ' + file.mimetype, 'BAD_FILE_TYPE'));
  },
});

function parseIdParam(req) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new ValidationError('Invalid ID');
  return id;
}

// =============================================================================
// Handlers — defined once, mounted N times below.
// =============================================================================

export const handlers = {
  upload: asyncHandler(async (req, res) => {
    checkGenericLimit(
      'media', 'uploaded_by', req.user.id,
      UPLOAD_RATE_LIMIT_PER_HOUR, 'upload'
    );

    const { media, auditMetadata } = await mediaService.upload(
      req.file, req.tenantId, req.user.id, req.body.alt
    );

    recordAudit(req, 'media.upload', {
      entityType: 'media', entityId: media.id, metadata: auditMetadata,
    });

    res.status(201).json(media);
  }),

  list: asyncHandler((req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    res.json(mediaService.list(req.tenantId, { limit, offset }));
  }),

  getById: asyncHandler((req, res) => {
    res.json(mediaService.getById(parseIdParam(req), req.tenantId));
  }),

  getUsage: asyncHandler((req, res) => {
    res.json(mediaService.getUsage(parseIdParam(req), req.tenantId));
  }),

  updateAlt: asyncHandler((req, res) => {
    const id = parseIdParam(req);
    const updated = mediaService.updateAlt(id, req.tenantId, req.body?.alt);
    recordAudit(req, 'media.update', { entityType: 'media', entityId: id });
    res.json(updated);
  }),

  softDelete: asyncHandler((req, res) => {
    const id = parseIdParam(req);
    const { result, auditMetadata } = mediaService.softDelete(id, req.tenantId);
    recordAudit(req, 'media.delete', {
      entityType: 'media', entityId: id, metadata: auditMetadata,
    });
    res.json(result);
  }),

  purge: asyncHandler(async (req, res) => {
    const id = parseIdParam(req);
    const { result, auditMetadata } = await mediaService.purge(id, req.tenantId);
    recordAudit(req, 'media.purge', {
      entityType: 'media', entityId: id, metadata: auditMetadata,
    });
    res.json(result);
  }),
};

// =============================================================================
// ADMIN ROUTER — /api/admin/media (canonical)
// =============================================================================
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.post('/',     requireRole('admin', 'editor'), upload.single('file'), handlers.upload);
adminRouter.get('/',      handlers.list);
adminRouter.get('/:id',   handlers.getById);
adminRouter.get('/:id/usage', handlers.getUsage);
adminRouter.patch('/:id', requireRole('admin', 'editor'), handlers.updateAlt);
adminRouter.delete('/:id', requireRole('admin'), handlers.softDelete);
adminRouter.post('/:id/purge', requireRole('admin'), handlers.purge);

// =============================================================================
// LEGACY ROUTER — /api/media (sunset 2026-09-01)
//
// Every legacy route applies the sunset middleware:
//   - Emits Sunset/Deprecation/Link headers (clients see migration target)
//   - After the date, returns 410 Gone with successor URL
// Each handler is mounted EXPLICITLY (no `.use(adminRouter)` shadow path).
// =============================================================================
export const legacyRouter = Router();

const sunsetUploads = sunset({
  date: LEGACY_SUNSET_DATE,
  successor: '/api/admin/media',
  reason: 'POST /api/media is replaced by POST /api/admin/media',
});
const sunsetAdmin = sunset({
  date: LEGACY_SUNSET_DATE,
  successor: '/api/admin/media',
});

// legacy had POST /api/media at the bare root.
legacyRouter.post('/',
  sunsetUploads, requireAuth, requireRole('admin', 'editor'),
  upload.single('file'), handlers.upload
);

// legacy also had /api/media/admin/* paths — re-mount handlers explicitly under
// the legacy prefix. NO `.use(adminRouter)` (would create shadow paths).
legacyRouter.post('/admin',
  sunsetAdmin, requireAuth, requireRole('admin', 'editor'),
  upload.single('file'), handlers.upload
);
legacyRouter.get('/admin',           sunsetAdmin, requireAuth, handlers.list);
legacyRouter.get('/admin/:id',       sunsetAdmin, requireAuth, handlers.getById);
legacyRouter.get('/admin/:id/usage', sunsetAdmin, requireAuth, handlers.getUsage);
legacyRouter.patch('/admin/:id',
  sunsetAdmin, requireAuth, requireRole('admin', 'editor'), handlers.updateAlt
);
legacyRouter.delete('/admin/:id',
  sunsetAdmin, requireAuth, requireRole('admin'), handlers.softDelete
);
legacyRouter.post('/admin/:id/purge',
  sunsetAdmin, requireAuth, requireRole('admin'), handlers.purge
);

export default legacyRouter;
