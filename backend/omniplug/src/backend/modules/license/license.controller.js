/**
 * license/license.controller.js — Admin license management.
 *
 * Endpoints (all admin-only, RBAC = admin):
 *   POST /api/admin/license/activate   — paste JWT, verify, persist
 *   POST /api/admin/license/sync-crl   — paste signed CRL, apply
 *   GET  /api/admin/license/status     — current tenant license + plan
 *
 * Body size: 8 KB cap (SEC-11) — JWT alone is ~1 KB; CRL might be a
 * few KB. server.js mounts an 8 KB parser before the global 1 MB parser.
 *
 * Side effects on successful activation:
 *   - INSERT/UPSERT into licenses (idempotent on jti)
 *   - UPDATE tenants SET license_id=?, plan_cached=?, plan_checked_at=now
 *   - INSERT into license_activations (SEC-7 replay tracking)
 *   - Audit log: license.activate.success / license.activation.replay_suspected
 *   - Reject if signed_for !== tenant.domain (SEC-6)
 */

import express from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../../core/lib/asyncHandler.js';
import { requireRole } from '../../../core/middleware/rbac.js';
import { recordAudit } from '../../../core/lib/audit.js';
import { verifyLicense } from '../../../core/lib/licenseKey.js';
import { syncCrl, isRevoked } from '../../../core/lib/crl.js';
import { validate } from '../../../core/middleware/validate.js';
import { normalizeDomain } from '../../../core/lib/domain.js';
import { licenseRepository } from './license.repository.js';

const router = express.Router();

// SEC-11: 8KB cap is mounted in server.js before the global 1MB parser.

const activateSchema = z.object({
  jwt: z.string().min(20).max(8000),
});

const syncCrlSchema = z.object({
  crl: z.array(z.object({
    jti: z.string(),
    revoked_at: z.string(),
    reason: z.string().optional(),
  })),
  crl_payload_hash: z.string(),
  crl_signature: z.string(),
});

router.post('/activate',
  requireRole('admin'),
  validate({ body: activateSchema }),
  asyncHandler(async (req, res) => {
    const { jwt } = req.validated.body;

    let payload;
    try {
      payload = verifyLicense(jwt);
    } catch (err) {
      recordAudit(req, 'license.activate.fail', {
        metadata: { code: err.code || 'LICENSE_VERIFY_FAILED', reason: err.message },
      });
      throw new HttpError(400, err.message, err.code || 'LICENSE_VERIFY_FAILED');
    }

    // SEC-6: signed_for vs tenant.domain
    const tenant = licenseRepository.findTenantDomain(req.tenantId);
    if (!tenant) {
      throw new HttpError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
    }
    const tenantDomain = normalizeDomain(tenant.domain);
    const signedFor = normalizeDomain(payload.signed_for);
    if (tenant.domain && !tenantDomain) {
      throw new HttpError(
        400,
        'Tenant domain is invalid; update tenant domain before activating license',
        'TENANT_DOMAIN_INVALID'
      );
    }
    if (payload.signed_for && !signedFor) {
      throw new HttpError(400, 'License signed_for domain is invalid', 'LICENSE_DOMAIN_INVALID');
    }
    if (signedFor && tenantDomain && signedFor !== tenantDomain) {
      recordAudit(req, 'license.activate.domain_mismatch', {
        metadata: { signed_for: signedFor, tenant_domain: tenantDomain, jti: payload.jti },
      });
      throw new HttpError(
        403,
        `License is bound to domain "${signedFor}" but this tenant is "${tenantDomain}"`,
        'LICENSE_DOMAIN_MISMATCH'
      );
    }

    // Revocation check
    if (isRevoked(payload.jti)) {
      recordAudit(req, 'license.activate.revoked', { metadata: { jti: payload.jti } });
      throw new HttpError(403, 'License has been revoked', 'LICENSE_REVOKED');
    }

    // SEC-7: replay detection
    const existingActivations = licenseRepository.countActivations(payload.jti);

    if (existingActivations > 0) {
      // Check whether the previous activation was for this same tenant —
      // if yes, that's just a re-activation (e.g. after data restore).
      // If different tenant, that's a replay attack candidate.
      const prevForOtherTenant = licenseRepository.countActivationsForOtherTenant(payload.jti, req.tenantId);

      recordAudit(req, 'license.activation.replay_suspected', {
        metadata: {
          jti: payload.jti,
          previous_activations: existingActivations,
          previous_for_other_tenant: prevForOtherTenant,
          tenant_id: req.tenantId,
        },
      });
      console.warn(`[license] ACTIVATION REPLAY: jti=${payload.jti} count=${existingActivations + 1} other_tenant=${prevForOtherTenant}`);
    }

    const issuedAtIso = payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString();
    const expiresAtIso = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;

    licenseRepository.activate({
      jwt,
      payload,
      tenantId: req.tenantId,
      userId: req.user?.id || null,
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'],
      issuedAtIso,
      expiresAtIso,
    });

    recordAudit(req, 'license.activate.success', {
      metadata: { jti: payload.jti, plan: payload.plan, signed_for: payload.signed_for },
    });

    res.json({
      ok: true,
      plan: payload.plan,
      plan_label: planLabel(payload.plan),
      jti: payload.jti,
      signed_for: payload.signed_for,
      expires_at: expiresAtIso,
      celebration: true,
    });
  })
);

router.post('/sync-crl',
  requireRole('admin'),
  validate({ body: syncCrlSchema }),
  asyncHandler((req, res) => {
    const applied = syncCrl(req.validated.body);
    recordAudit(req, 'license.crl.sync', { metadata: { applied } });
    res.json({ ok: true, applied });
  })
);

router.get('/status',
  requireRole('admin', 'editor'),
  asyncHandler((req, res) => {
    const row = licenseRepository.getStatus(req.tenantId);

    if (!row) return res.json({ plan: 'community', license: null });

    const revoked = row.jti ? isRevoked(row.jti) : false;
    res.json({
      plan: row.plan || 'community',
      plan_label: planLabel(row.plan || 'community'),
      plan_checked_at: row.plan_checked_at,
      license: row.jti ? {
        jti: row.jti,
        signed_for: row.signed_for,
        customer_name: row.customer_name,
        expires_at: row.expires_at,
        status: revoked ? 'revoked' : row.license_status,
      } : null,
    });
  })
);

function planLabel(plan) {
  return ({
    community: 'Community Free',
    lite:      'Lite Landing',
    standard:  'Standard',
    pro:       'Pro',
    pro_plus:  'Pro+',
  })[plan] || plan;
}

export default router;
