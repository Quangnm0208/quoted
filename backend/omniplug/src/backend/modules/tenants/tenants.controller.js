/**
 * tenants/tenants.controller.js — Tenant CRUD (PLATFORM-ADMIN only).
 *
 * Critical access constraint:
 *   - Endpoint này quản lý tất cả tenants → KHÔNG được cho tenant admin
 *     thường truy cập. Otherwise tenant 2 admin có thể list/edit/archive
 *     tenant 1, 3, ...
 *
 *   - "Platform admin" definition (lightweight, không thêm role mới):
 *       role === 'admin' AND tenant_id === DEFAULT_TENANT_ID (= 1)
 *
 *     Nghĩa là: chỉ admin của default tenant (Demo Tenant) có quyền platform-level.
 *     Khi cần phân quyền chi tiết hơn → thêm role 'platform_admin' riêng
 *     (already supported in v1.4.x via `roles.js`).
 *
 * Mount: /api/admin/tenants
 *
 * Endpoints:
 *   GET    /                — list all tenants
 *   GET    /:id             — single tenant
 *   POST   /                — create (slug + name required, domain optional)
 *   PATCH  /:id             — update name/domain/status/settings
 *   DELETE /:id             — ARCHIVE (status='archived'), KHÔNG CASCADE
 *   POST   /:id/restore     — unarchive (status='active')
 *
 * Safety:
 *   - KHÔNG cho phép archive default tenant (id=1)
 *   - KHÔNG có hard delete từ admin UI (DBA SQL manual để purge)
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { DEFAULT_TENANT_ID } from '../../../core/lib/tenancy.js';
import { normalizeDomain } from '../../../core/lib/domain.js';
import { tenantsRepository } from './tenants.repository.js';

const router = Router();

function decorate(row) {
  if (!row) return null;
  let settings = {};
  try { settings = JSON.parse(row.settings_json); } catch {}
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain,
    status: row.status,
    settings,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const createSchema = z.object({
  slug:    z.string().regex(/^[a-z0-9-]+$/i, 'Slug chỉ chứa chữ, số, dấu gạch').min(2).max(50),
  name:    z.string().min(1).max(200),
  domain:  z.string().max(200).nullable().optional(),
  status:  z.enum(['active', 'suspended', 'archived']).optional(),
  settings: z.record(z.any()).optional(),
});

const updateSchema = createSchema.partial().omit({ slug: true });   // slug không đổi sau khi tạo

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

function normalizeTenantDomainInput(domain) {
  if (!domain) return null;
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    throw new ValidationError('Domain khong hop le', {
      fieldErrors: { domain: ['Domain must be a valid hostname or URL'] },
    });
  }
  return normalized;
}

/**
 * Platform admin guard (v1.4 backward-compat).
 * Option 1: role='platform_admin'       - chuan moi
 * Option 2: role='admin' AND tenant_id=1 - cu, van work
 * Xoa option 2 trong v2.0 sau khi tat ca installs migrate.
 */
function requirePlatformAdmin(req, res, next) {
  if (!req.user) {
    return next(new ForbiddenError('Auth required', 'PLATFORM_ADMIN_REQUIRED'));
  }
  const ok =
    req.user.role === 'platform_admin' ||
    (req.user.role === 'admin' && req.user.tenant_id === DEFAULT_TENANT_ID);
  if (!ok) {
    return next(new ForbiddenError(
      'Platform admin only. Dung role=platform_admin hoac lien he super admin.',
      'PLATFORM_ADMIN_REQUIRED'
    ));
  }
  next();
}

// All routes require platform admin
router.use(requirePlatformAdmin);

router.get('/', asyncHandler((req, res) => {
  res.json({ rows: tenantsRepository.list().map(decorate) });
}));

router.get('/:id', validate({ params: idParamSchema }), asyncHandler((req, res) => {
  const row = tenantsRepository.findById(req.validated.params.id);
  if (!row) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');
  res.json(decorate(row));
}));

router.post('/', validate({ body: createSchema }), asyncHandler((req, res) => {
  const { slug, name, domain = null, status = 'active', settings = {} } = req.validated.body;

  if (tenantsRepository.findBySlug(slug)) {
    throw new ConflictError(`Slug "${slug}" đã tồn tại`, 'SLUG_EXISTS');
  }

  const normalizedDomain = normalizeTenantDomainInput(domain);
  let info;
  try {
    info = tenantsRepository.create({
      slug: slug.toLowerCase(),
      name,
      domain: normalizedDomain,
      status,
      settings_json: JSON.stringify(settings),
    });
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE' && /idx_tenants_domain_unique/.test(err.message)) {
      throw new ConflictError(`Domain "${normalizedDomain}" đã được sử dụng bởi tenant khác`, 'DOMAIN_EXISTS');
    }
    throw err;
  }
  const created = decorate(tenantsRepository.findById(info.lastInsertRowid));

  recordAudit(req, 'tenant.create', {
    entityType: 'tenant',
    entityId: created.id,
    metadata: { slug: created.slug, name: created.name },
  });

  res.status(201).json(created);
}));

router.patch('/:id', validate({ params: idParamSchema, body: updateSchema }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const existing = tenantsRepository.findById(id);
  if (!existing) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');

  const data = req.validated.body;
  const settings = data.settings !== undefined ? JSON.stringify(data.settings) : existing.settings_json;

  const newDomain = data.domain !== undefined
    ? normalizeTenantDomainInput(data.domain)
    : existing.domain;
  try {
    tenantsRepository.update({
      id,
      name:    data.name ?? existing.name,
      domain:  newDomain,
      status:  data.status ?? existing.status,
      settings_json: settings,
    });
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE' && /idx_tenants_domain_unique/.test(err.message)) {
      throw new ConflictError(`Domain "${newDomain}" đã được sử dụng bởi tenant khác`, 'DOMAIN_EXISTS');
    }
    throw err;
  }

  recordAudit(req, 'tenant.update', {
    entityType: 'tenant',
    entityId: id,
    metadata: { changes: Object.keys(data) },
  });

  res.json(decorate(tenantsRepository.findById(id)));
}));

/**
 * DELETE /api/admin/tenants/:id
 *
 * ARCHIVE thay vì hard DELETE. KHÔNG CASCADE xóa data.
 *   - Set status='archived' → tenant không serve traffic nữa
 *   - Public requests về domain này → 404 Tenant Not Found
 *   - Admin users của tenant này → 403 TENANT_INACTIVE on login
 *   - Data preserved cho restore future
 *
 * Để thực sự purge (super_admin operation), DBA chạy SQL manual:
 *     DELETE FROM tenants WHERE id = X;
 * → FK CASCADE sẽ wipe data. Đây là ngoài admin UI flow.
 */
router.delete('/:id', validate({ params: idParamSchema }), asyncHandler((req, res) => {
  const id = req.validated.params.id;

  // Safety: không archive default tenant
  if (id === DEFAULT_TENANT_ID) {
    throw new ValidationError('Không thể archive default tenant (id=1)');
  }

  const existing = tenantsRepository.findById(id);
  if (!existing) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');
  if (existing.status === 'archived') {
    throw new ValidationError('Tenant đã ở trạng thái archived');
  }

  // ARCHIVE (soft) — set status='archived'. KHÔNG CASCADE.
  tenantsRepository.update({
    id,
    name: existing.name,
    domain: existing.domain,
    status: 'archived',
    settings_json: existing.settings_json,
  });

  recordAudit(req, 'tenant.archive', {
    entityType: 'tenant',
    entityId: id,
    metadata: { slug: existing.slug, was_status: existing.status },
  });

  res.json({
    archived: true,
    tenant_id: id,
    note: 'Data preserved. Tenant không serve traffic. Để purge data: DBA SQL manual.',
  });
}));

/**
 * POST /api/admin/tenants/:id/restore — unarchive tenant.
 */
router.post('/:id/restore', validate({ params: idParamSchema }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const existing = tenantsRepository.findById(id);
  if (!existing) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');
  if (existing.status === 'active') {
    throw new ValidationError('Tenant đã active');
  }

  tenantsRepository.update({
    id,
    name: existing.name,
    domain: existing.domain,
    status: 'active',
    settings_json: existing.settings_json,
  });

  recordAudit(req, 'tenant.restore', {
    entityType: 'tenant', entityId: id,
    metadata: { slug: existing.slug, was_status: existing.status },
  });

  res.json(decorate(tenantsRepository.findById(id)));
}));

export default router;
