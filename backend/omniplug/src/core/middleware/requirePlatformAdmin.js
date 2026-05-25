/**
 * middleware/requirePlatformAdmin.js
 *
 * Gates routes that expose cross-tenant SaaS operator data — e.g.
 * /api/admin/quoted/* (customers, subscriptions, orders, revenue).
 *
 * Distinct from `requireAuth` (any logged-in user) and the OmniPlug
 * generic admin role (admin of A tenant). A "platform admin" is an
 * operator account that owns the Quoted SaaS itself — by current
 * deployment policy: tenant_id === 1 (the operator tenant) AND role
 * === 'admin'.
 *
 * Rationale: in a single-product Quoted deployment, tenant 1 IS the
 * operator. If we later multi-tenant Quoted (selling per-org dashboards),
 * promote 'admin' on tenant 1 to a dedicated 'platform_admin' role and
 * tighten this check — until then, the (tenant_id=1, role=admin) tuple
 * is the operator boundary.
 *
 * Reject everything else with 403 PLATFORM_ADMIN_REQUIRED.
 *
 * Acceptance (from master prompt P0.1):
 *   - Tenant admin (tenant_id != 1) → 403
 *   - Platform admin (tenant_id == 1, role admin) → pass
 *   - Unauthenticated → 401 (handled upstream by requireAuth)
 */

const PLATFORM_TENANT_ID = Number(process.env.PLATFORM_TENANT_ID || 1);

export function requirePlatformAdmin(req, res, next) {
  // requireAuth runs first; if no user, error already thrown
  if (!req.user) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' },
    });
  }
  const isAdmin = req.user.role === 'admin';
  const isPlatformTenant = Number(req.user.tenant_id) === PLATFORM_TENANT_ID;
  if (!isAdmin || !isPlatformTenant) {
    return res.status(403).json({
      error: {
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Cross-tenant SaaS operator data is restricted to platform admin.',
      },
    });
  }
  next();
}
