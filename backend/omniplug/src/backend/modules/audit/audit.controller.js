/**
 * audit/audit.controller.js — Admin view audit log.
 *
 * GET /api/admin/audit
 *   Query: action (prefix or exact), userId, since (ISO), limit, offset
 *
 * Admin-only. Read-only — log immutable từ ngoài, chỉ controllers internal ghi.
 */

import { Router } from 'express';
import { requireAuth } from '../../../core/middleware/auth.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { asyncHandler } from '../../../core/lib/asyncHandler.js';
import { auditQuery } from '../../../core/lib/audit.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), asyncHandler((req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const result = auditQuery.list({
    limit,
    offset,
    tenantId: req.tenantId,                          // scope per tenant
    action: req.query.action || undefined,
    userId: req.query.userId ? parseInt(req.query.userId, 10) : undefined,
    since: req.query.since || undefined,
  });
  // Parse metadata_json để dễ dùng phía client
  result.rows = result.rows.map(r => {
    let metadata = {};
    try { metadata = JSON.parse(r.metadata_json || '{}'); } catch {}
    return {
      id: r.id,
      user_id: r.user_id,
      user_email: r.user_email,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      ip_address: r.ip_address,
      metadata,
      created_at: r.created_at,
    };
  });
  res.json(result);
}));

export default router;
