/**
 * users/users.controller.js — User management (v1.4.4).
 *
 * Behavior:
 *   - DELETE → soft delete (is_active=0 + deleted_at). KHÔNG hard DELETE row.
 *   - List filter is_active=1 + deleted_at IS NULL by default.
 *   - POST /:id/reactivate → bật lại user.
 *   - GET ?include_inactive=1 → admin xem cả deactivated.
 *
 * Reason: preserve audit history + ownership trail + tránh broken FK references.
 */

import { Router } from 'express';
import { z } from 'zod';
import { hashPassword } from '../../../core/lib/password.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { ALL_ROLES, isElevatedRole } from '../../../core/lib/roles.js';
import { usersRepository } from './users.repository.js';


const createSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  display_name: z.string().min(1).max(200),
  role: z.enum(ALL_ROLES),
});

const updateSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  role: z.enum(ALL_ROLES).optional(),
});

const passwordSchema = z.object({ password: z.string().min(8).max(200) });
const idParam = z.object({ id: z.coerce.number().int().positive() });

const router = Router();

// Tenant admins manage normal users; platform_admin is required for elevated roles.
router.use(requireRole('admin', 'platform_admin'));

router.get('/', asyncHandler((req, res) => {
  const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true';
  const rows = usersRepository.list(req.tenantId, { includeInactive });
  res.json({ rows });
}));

router.get('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const row = usersRepository.findById(req.validated.params.id, req.tenantId);
  if (!row) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  res.json(row);
}));

router.post('/', validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const { email, password, display_name, role } = req.validated.body;
  const lowercased = email.toLowerCase();

  // CB-01 (F5): chặn tenant admin tự assign platform_admin cho user mới.
  if (isElevatedRole(role) && req.user.role !== 'platform_admin') {
    throw new ForbiddenError(
      'Chỉ platform_admin mới có thể assign role này',
      'ROLE_ELEVATION_DENIED'
    );
  }

  // Email globally unique check
  const existing = usersRepository.findByEmail(lowercased);
  if (existing) {
    // Special case: if deactivated user với cùng email → khuyên reactivate
    if (existing.tenant_id === req.tenantId && existing.is_active === 0) {
      throw new ConflictError(
        `Email đã tồn tại nhưng đã bị deactivate. Reactivate user id ${existing.id} thay vì tạo mới.`,
        'USER_DEACTIVATED'
      );
    }
    throw new ConflictError('Email đã được sử dụng', 'EMAIL_EXISTS');
  }

  const hash = await hashPassword(password);
  const info = usersRepository.create({
    tenant_id: req.tenantId,
    email: lowercased,
    password_hash: hash,
    display_name,
    role,
  });
  const created = usersRepository.findById(info.lastInsertRowid, req.tenantId);

  recordAudit(req, 'user.create', {
    entityType: 'user', entityId: created.id,
    metadata: { email: created.email, role },
  });

  res.status(201).json(created);
}));

router.patch('/:id', validate({ params: idParam, body: updateSchema }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const existing = usersRepository.findActiveById(id, req.tenantId);
  if (!existing) throw new NotFoundError('User not found or inactive', 'USER_NOT_FOUND');

  const data = req.validated.body;

  // CB-01 (F5): chặn tenant admin patch user lên platform_admin.
  if (data.role && isElevatedRole(data.role) && req.user.role !== 'platform_admin') {
    throw new ForbiddenError(
      'Chỉ platform_admin mới có thể assign role này',
      'ROLE_ELEVATION_DENIED'
    );
  }

  // Self-demote guard
  if (id === req.user.id && data.role && data.role !== existing.role) {
    throw new ValidationError('Không thể tự đổi role của chính mình');
  }

  usersRepository.update(
    data.display_name ?? existing.display_name,
    data.role ?? existing.role,
    id, req.tenantId
  );
  recordAudit(req, 'user.update', {
    entityType: 'user', entityId: id,
    metadata: { changes: Object.keys(data) },
  });
  res.json(usersRepository.findById(id, req.tenantId));
}));

router.put('/:id/password',
  validate({ params: idParam, body: passwordSchema }),
  asyncHandler(async (req, res) => {
    const id = req.validated.params.id;
    const existing = usersRepository.findActiveById(id, req.tenantId);
    if (!existing) throw new NotFoundError('User not found or inactive', 'USER_NOT_FOUND');

    const hash = await hashPassword(req.validated.body.password);
    usersRepository.updatePassword(hash, id, req.tenantId);

    recordAudit(req, 'user.password.reset', {
      entityType: 'user', entityId: id, metadata: { by_admin: true },
    });
    res.json({ ok: true });
  })
);

/**
 * DELETE /api/admin/users/:id — SOFT DELETE (deactivate).
 *
 * KHÔNG hard DELETE. UPDATE is_active=0 + deleted_at=now().
 * Preserve audit history + ownership trail.
 */
router.delete('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const id = req.validated.params.id;

  if (id === req.user.id) {
    throw new ValidationError('Không thể tự xóa tài khoản của chính mình');
  }

  const existing = usersRepository.findActiveById(id, req.tenantId);
  if (!existing) throw new NotFoundError('User not found or already deactivated', 'USER_NOT_FOUND');

  const info = usersRepository.softDelete(id, req.tenantId);
  if (info.changes === 0) throw new NotFoundError('User not found', 'USER_NOT_FOUND');

  recordAudit(req, 'user.deactivate', {
    entityType: 'user', entityId: id,
    metadata: { email: existing.email, soft: true },
  });
  res.json({ deactivated: true, soft: true, user_id: id });
}));

/**
 * POST /api/admin/users/:id/reactivate — bật lại user đã deactivate.
 */
router.post('/:id/reactivate', validate({ params: idParam }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const existing = usersRepository.findById(id, req.tenantId);
  if (!existing) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  if (existing.is_active === 1 && !existing.deleted_at) {
    throw new ValidationError('User already active');
  }

  usersRepository.reactivate(id, req.tenantId);
  recordAudit(req, 'user.reactivate', { entityType: 'user', entityId: id });
  res.json(usersRepository.findById(id, req.tenantId));
}));

export default router;
