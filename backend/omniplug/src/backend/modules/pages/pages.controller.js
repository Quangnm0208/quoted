/**
 * pages/pages.controller.js — Dynamic page sections (v1.4.4 tenant-aware).
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError, ValidationError, ConflictError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { pagesRepository } from './pages.repository.js';

const COMPONENT_TYPES = [
  'hero_banner', 'rich_text', 'stat_grid', 'cta_block',
  'gallery_block', 'feature_list', 'project_card_list',
];

function parsePayload(s) { try { return JSON.parse(s); } catch { return {}; } }

function decorate(row) {
  if (!row) return null;
  return {
    id: row.id, page_key: row.page_key, section_key: row.section_key,
    component_type: row.component_type, title: row.title, subtitle: row.subtitle,
    payload: parsePayload(row.payload_json),
    sort_order: row.sort_order, is_visible: !!row.is_visible,
    updated_at: row.updated_at,
  };
}

const sectionSchema = z.object({
  section_key: z.string().min(1).max(100),
  component_type: z.enum(COMPONENT_TYPES),
  title: z.string().max(500).optional(),
  subtitle: z.string().max(1000).optional(),
  payload: z.unknown().optional(),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

const sectionUpdateSchema = sectionSchema.partial();
const idParam = z.object({ id: z.coerce.number().int().positive() });

// =========================================================
// PUBLIC ROUTER — /api/public/pages/:pageKey
// =========================================================
export const publicRouter = Router();
publicRouter.get('/:pageKey', asyncHandler((req, res) => {
  const sections = pagesRepository.listByPagePublic(req.tenantId, req.params.pageKey).map(decorate);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    page: req.params.pageKey,
    sections: sections.map(s => ({
      key: s.section_key, type: s.component_type,
      title: s.title, subtitle: s.subtitle, payload: s.payload,
    })),
  });
}));

// =========================================================
// ADMIN ROUTER — /api/admin/pages
// =========================================================
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get('/', asyncHandler((req, res) => {
  const all = pagesRepository.listAll(req.tenantId).map(decorate);
  const grouped = {};
  for (const s of all) {
    if (!grouped[s.page_key]) grouped[s.page_key] = [];
    grouped[s.page_key].push(s);
  }
  res.json(grouped);
}));

adminRouter.get('/:pageKey', asyncHandler((req, res) => {
  res.json(pagesRepository.listByPage(req.tenantId, req.params.pageKey).map(decorate));
}));

adminRouter.post('/:pageKey/sections',
  requireRole('admin', 'editor'),
  validate({ body: sectionSchema }),
  asyncHandler((req, res) => {
    const data = req.validated.body;
    const pageKey = req.params.pageKey;
    const nextSort = pagesRepository.nextSort(req.tenantId, pageKey);

    try {
      const info = pagesRepository.create({
        tenant_id: req.tenantId,
        page_key: pageKey,
        section_key: data.section_key,
        component_type: data.component_type,
        title: data.title || '',
        subtitle: data.subtitle || '',
        payload_json: JSON.stringify(data.payload || {}),
        sort_order: data.sort_order ?? nextSort,
        is_visible: data.is_visible !== false ? 1 : 0,
        updated_by: req.user.id,
      });
      const created = pagesRepository.findById(info.lastInsertRowid, req.tenantId);
      recordAudit(req, 'page.section.create', {
        entityType: 'page_section', entityId: created.id,
        metadata: { page_key: pageKey, section_key: data.section_key },
      });
      res.status(201).json(decorate(created));
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        throw new ConflictError(
          `Section "${data.section_key}" đã tồn tại trên trang "${pageKey}"`,
          'DUPLICATE_SECTION'
        );
      }
      throw e;
    }
  })
);

adminRouter.patch('/sections/:id',
  requireRole('admin', 'editor'),
  validate({ params: idParam, body: sectionUpdateSchema }),
  asyncHandler((req, res) => {
    const id = req.validated.params.id;
    const existing = pagesRepository.findById(id, req.tenantId);
    if (!existing) throw new NotFoundError('Section not found');

    const data = req.validated.body;
    pagesRepository.update({
      id, tenant_id: req.tenantId,
      section_key: data.section_key ?? existing.section_key,
      component_type: data.component_type ?? existing.component_type,
      title: data.title ?? existing.title,
      subtitle: data.subtitle ?? existing.subtitle,
      payload_json: data.payload !== undefined ? JSON.stringify(data.payload) : existing.payload_json,
      sort_order: data.sort_order ?? existing.sort_order,
      is_visible: data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : existing.is_visible,
      updated_by: req.user.id,
    });
    recordAudit(req, 'page.section.update', {
      entityType: 'page_section', entityId: id,
      metadata: { changes: Object.keys(data) },
    });
    res.json(decorate(pagesRepository.findById(id, req.tenantId)));
  })
);

adminRouter.post('/sections/:id/reorder',
  requireRole('admin', 'editor'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const id = req.validated.params.id;
    const newSort = parseInt(req.body?.sort_order, 10);
    if (Number.isNaN(newSort)) throw new ValidationError('sort_order required');
    const info = pagesRepository.updateSort(newSort, id, req.tenantId);
    if (info.changes === 0) throw new NotFoundError('Section not found');
    recordAudit(req, 'page.section.reorder', { entityType: 'page_section', entityId: id });
    res.json({ ok: true });
  })
);

adminRouter.delete('/sections/:id',
  requireRole('admin'),
  validate({ params: idParam }),
  asyncHandler((req, res) => {
    const id = req.validated.params.id;
    const existing = pagesRepository.findById(id, req.tenantId);
    if (!existing) throw new NotFoundError('Section not found');
    pagesRepository.delete(id, req.tenantId);
    recordAudit(req, 'page.section.delete', {
      entityType: 'page_section', entityId: id,
      metadata: { page_key: existing.page_key, section_key: existing.section_key },
    });
    res.json({ deleted: true });
  })
);

// =========================================================
// LEGACY — backward compat (legacy mounted differently)
// =========================================================
// legacy had: app.use('/api/pages', pagesRoutes) + app.use('/api/admin/pages', adminPagesRouter)
// Both export names kept for backward compat

export const adminPagesRouter = adminRouter;     // alias for legacy server.js compat
export default publicRouter;                      // default = public (legacy mounting style)
