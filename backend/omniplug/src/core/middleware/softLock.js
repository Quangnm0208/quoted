/**
 * core/middleware/softLock.js — PII masking response interceptor.
 *
 * For community-plan tenants: intercept JSON responses on lead admin
 * endpoints and apply maskLead to row data. Other plans pass through.
 *
 * Hooks res.json — does NOT modify res.send because non-JSON paths
 * (downloads, CSV exports) need their own per-route gating.
 *
 * Banner injection (admin HTML): handled separately by softlock-banner.js
 * embedded in /admin/leads.html. This middleware only handles API output.
 */

import { shouldMaskPii } from '../lib/planQuotas.js';
import { maskLead } from '../lib/maskers.js';

function isLeadShape(obj) {
  return obj && typeof obj === 'object' &&
    'phone' in obj && 'name' in obj;
}

function maskBody(body, plan) {
  if (!shouldMaskPii(plan)) return body;

  // Common shapes:
  //   { rows: [...], total, limit, offset }   ← list
  //   { id, name, phone, email, ... }         ← single
  //   array of leads                          ← legacy
  if (Array.isArray(body)) {
    return body.map(r => isLeadShape(r) ? maskLead(r) : r);
  }
  if (body && Array.isArray(body.rows)) {
    return {
      ...body,
      rows: body.rows.map(r => isLeadShape(r) ? maskLead(r) : r),
      _quota_notice: 'Community Free: liên hệ bị che. Nâng cấp Lite để mở khoá.',
    };
  }
  if (isLeadShape(body)) {
    return maskLead(body);
  }
  return body;
}

export function maskLeadsForPlan(req, res, next) {
  const plan = req.licensePlan || (req.tenant && req.tenant.plan_cached) || 'community';
  if (!shouldMaskPii(plan)) return next();

  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(maskBody(body, plan));
  next();
}
