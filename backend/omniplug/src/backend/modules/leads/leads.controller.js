/**
 * leads/leads.controller.js — Lead capture (v1.4.4 tenant-aware).
 *
 * Exports:
 *   publicRouter — mounted /api/public/leads (POST only)
 *   adminRouter  — mounted /api/admin/leads
 *   default      — legacy /api/leads with both
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { validate } from '../../../core/middleware/validate.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { NotFoundError, RateLimitError, ValidationError } from '../../../core/lib/errors.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { env } from '../../../core/config/env.js';
import { leadsRepository } from './leads.repository.js';

const leadInputSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^[0-9+\s\-()]{8,20}$/, 'Số điện thoại không hợp lệ'),
  email: z.union([z.string().email().max(200), z.literal(''), z.undefined(), z.null()]).optional(),
  website: z.string().max(0).optional(),
  source: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  include_deleted: z.coerce.boolean().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']),
  notes: z.string().max(2000).optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

function honeypotFilled(req) {
  return String(req.body?.website || '').trim() !== '';
}

function blockHoneypot(req, res, next) {
  if (!honeypotFilled(req)) return next();

  const body = req.body || {};
  const ip = req.ip || 'unknown';
  recordAudit(req, 'lead.honeypot_blocked', {
    metadata: {
      ip,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 100),
      has_phone: Boolean(body.phone),
      has_email: Boolean(body.email),
    },
  });

  res.status(201).json({
    ok: true,
    lead_id: crypto.randomInt(100000, 1000000),
  });
}

// =========================================================
// PUBLIC ROUTER — /api/public/leads (POST only)
// =========================================================
export const publicRouter = Router();

publicRouter.post('/', blockHoneypot, validate({ body: leadInputSchema }), asyncHandler((req, res) => {
  const data = req.validated.body;
  const ip = req.ip || 'unknown';
  // Dev-mode localhost exemption (consistent with rateLimiterIp + rateLimit).
  // Test suites do many lead inserts; without this, the 6th+ lead in any
  // hour hits 429. Production traffic never originates from 127.0.0.1.
  const isDevLocal = process.env.NODE_ENV !== 'production' &&
    (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
  if (!isDevLocal) {
    const recent = leadsRepository.countByIPLastHour(req.tenantId, ip);
    if (recent >= env.LEAD_RATE_LIMIT_PER_HOUR) {
      throw new RateLimitError('Too many submissions. Try again later.');
    }
  }

  const info = leadsRepository.create({
    tenant_id: req.tenantId,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: (data.email || '').trim() || null,
    source: data.source || 'landing',
    notes: data.notes || '',
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
    ip_address: ip,
    referer: String(req.headers.referer || '').slice(0, 500),
  });

  recordAudit(req, 'lead.create', {
    entityType: 'lead', entityId: info.lastInsertRowid,
    metadata: { source: data.source || 'landing' },
  });

  res.status(201).json({ ok: true, lead_id: info.lastInsertRowid });
}));

// =========================================================
// ADMIN ROUTER — /api/admin/leads
// =========================================================
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get('/', validate({ query: listQuerySchema }), asyncHandler((req, res) => {
  const { status, search, limit = 50, offset = 0, include_deleted } = req.validated.query;
  const { rows, total } = leadsRepository.list({
    tenantId: req.tenantId,
    status,
    search,
    includeDeleted: include_deleted,
    limit,
    offset,
  });
  res.json({ rows, total, limit, offset });
}));

adminRouter.get('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const row = leadsRepository.findByIdAny(req.validated.params.id, req.tenantId);
  if (!row) throw new NotFoundError('Lead not found', 'LEAD_NOT_FOUND');
  res.json(row);
}));

adminRouter.patch('/:id', requireRole('admin', 'editor'), validate({ params: idParam, body: statusUpdateSchema }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const existing = leadsRepository.findById(id, req.tenantId);
  if (!existing) throw new NotFoundError('Lead not found', 'LEAD_NOT_FOUND');

  leadsRepository.updateStatus(
    req.validated.body.status,
    req.validated.body.notes !== undefined ? req.validated.body.notes : existing.notes,
    id, req.tenantId
  );
  recordAudit(req, 'lead.update', {
    entityType: 'lead', entityId: id,
    metadata: { status: req.validated.body.status },
  });
  res.json(leadsRepository.findById(id, req.tenantId));
}));

adminRouter.delete('/:id', requireRole('admin'), validate({ params: idParam }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const info = leadsRepository.softDelete(id, req.tenantId);
  if (info.changes === 0) throw new NotFoundError('Lead not found', 'LEAD_NOT_FOUND');
  recordAudit(req, 'lead.delete', { entityType: 'lead', entityId: id, metadata: { soft: true } });
  res.json({ deleted: true, soft: true });
}));

adminRouter.post('/:id/restore', requireRole('admin'), validate({ params: idParam }), asyncHandler((req, res) => {
  const id = req.validated.params.id;
  const info = leadsRepository.restore(id, req.tenantId);
  if (info.changes === 0) throw new NotFoundError('Lead not deleted', 'NOT_DELETED');
  recordAudit(req, 'lead.restore', { entityType: 'lead', entityId: id });
  res.json({ restored: true });
}));

// =========================================================
// LEGACY ROUTER — backward compat /api/leads + /api/leads/admin
// =========================================================
export const legacyRouter = Router();
legacyRouter.use((req, res, next) => {
  res.set('X-API-Deprecated', 'Use /api/public/leads or /api/admin/leads');
  next();
});

// POST /api/leads — public submit
legacyRouter.post('/', blockHoneypot, validate({ body: leadInputSchema }), asyncHandler((req, res) => {
  // Re-use publicRouter logic
  const data = req.validated.body;
  const ip = req.ip || 'unknown';
  // Dev-mode localhost exemption (consistent with rateLimiterIp + rateLimit).
  // Test suites do many lead inserts; without this, the 6th+ lead in any
  // hour hits 429. Production traffic never originates from 127.0.0.1.
  const isDevLocal = process.env.NODE_ENV !== 'production' &&
    (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
  if (!isDevLocal) {
    const recent = leadsRepository.countByIPLastHour(req.tenantId, ip);
    if (recent >= env.LEAD_RATE_LIMIT_PER_HOUR) {
      throw new RateLimitError('Too many submissions. Try again later.');
    }
  }
  const info = leadsRepository.create({
    tenant_id: req.tenantId,
    name: data.name.trim(), phone: data.phone.trim(),
    email: (data.email || '').trim() || null,
    source: data.source || 'landing', notes: data.notes || '',
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
    ip_address: ip,
    referer: String(req.headers.referer || '').slice(0, 500),
  });
  recordAudit(req, 'lead.create', { entityType: 'lead', entityId: info.lastInsertRowid });
  res.status(201).json({ ok: true, lead_id: info.lastInsertRowid });
}));

// Admin sub-routes
legacyRouter.use('/admin', adminRouter);

export default legacyRouter;
