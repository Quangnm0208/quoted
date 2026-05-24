/**
 * core/middleware/licenseGate.js — Gate API access by license/plan.
 *
 * v1.4.4 — see PROMPT v1.4.4 §3 SEC-12.
 *
 * Mode (env LICENSE_ENFORCEMENT):
 *   strict (default in prod)  — refuse with 402 PAYMENT_REQUIRED if no active license
 *   warn                      — pass through, log every 60s (SEC-9)
 *   off                       — pass through silently (dev only)
 *
 * Resolution path:
 *   1. req.tenant.plan_cached set by tenant middleware → use it
 *   2. NULL/community → soft-locked: refuse paid endpoints
 *   3. Active plan → set req.licensePlan + req.licenseQuotas, next()
 *
 * Refusal payload:
 *   {
 *     ok: false,
 *     error: {
 *       code: 'LICENSE_REQUIRED' | 'LICENSE_REVOKED' | 'LICENSE_EXPIRED',
 *       message: '...',
 *       upgrade_url: 'https://omniplug.com/pricing',
 *       plan: 'community'
 *     }
 *   }
 */

import db from '../db/connection.js';
import { env } from '../config/env.js';
import { isRevoked } from '../lib/crl.js';
import { getPlanQuotas } from '../lib/planQuotas.js';

const ENFORCEMENT = (process.env.LICENSE_ENFORCEMENT || (env.NODE_ENV === 'production' ? 'strict' : 'warn')).toLowerCase();

const _tenantLookup = (() => {
  let s = null;
  return () => {
    if (!s) {
      s = db.prepare(`
        SELECT t.id            AS tenant_id,
               t.plan_cached   AS plan_cached,
               t.license_id    AS license_id,
               l.jti           AS jti,
               l.status        AS license_status,
               l.expires_at    AS expires_at,
               l.plan          AS license_plan
          FROM tenants t
          LEFT JOIN licenses l ON l.id = t.license_id
         WHERE t.id = ?
      `);
    }
    return s;
  };
})();

function refuse(res, code, message, plan = 'community') {
  return res.status(402).json({
    ok: false,
    error: {
      code,
      message,
      upgrade_url: 'https://omniplug.com/pricing',
      plan,
    },
    message,
  });
}

/**
 * Express middleware. Mounted on /api/v1/*.
 * Requires req.tenantId to be already resolved (auth or host).
 */
export function licenseGate(req, res, next) {
  if (ENFORCEMENT === 'off') return next();

  const tenantId = req.tenantId;
  if (!tenantId) {
    // No tenant resolved — let downstream handle the 404/tenant error.
    // We do NOT gate here because that would mask a tenant-resolution
    // bug behind a license error.
    return next();
  }

  const row = _tenantLookup().get(tenantId);
  if (!row) return next();   // Tenant disappeared mid-request — defer

  // Plan resolution
  const plan = row.plan_cached || 'community';
  const quotas = getPlanQuotas(plan);

  // License status checks (only when an actual license is linked)
  if (row.license_id) {
    if (row.license_status === 'revoked' || (row.jti && isRevoked(row.jti))) {
      if (ENFORCEMENT === 'warn') {
        req.licensePlan = plan;
        req.licenseQuotas = quotas;
        return next();
      }
      return refuse(res, 'LICENSE_REVOKED',
        'License đã bị thu hồi. Liên hệ OmniPlug để khôi phục.', plan);
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      if (ENFORCEMENT === 'warn') {
        req.licensePlan = plan;
        req.licenseQuotas = quotas;
        return next();
      }
      return refuse(res, 'LICENSE_EXPIRED',
        'License đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.', plan);
    }
  }

  // Soft-lock: community plan can't call /api/v1/* (paid endpoints)
  if (quotas.soft_lock) {
    if (ENFORCEMENT === 'warn') {
      // pass through but mark
      req.licensePlan = plan;
      req.licenseQuotas = quotas;
      return next();
    }
    return refuse(res, 'LICENSE_REQUIRED',
      'Endpoint này yêu cầu gói trả phí. Hiện tại bạn đang dùng gói Community Free.', plan);
  }

  req.licensePlan = plan;
  req.licenseQuotas = quotas;
  next();
}

export function enforcementMode() {
  return ENFORCEMENT;
}
