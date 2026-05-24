/**
 * middleware/tenant.js — Tenant resolution (v1.4.4).
 *
 * Historical blocker fixes still in force (introduced v1.2):
 *
 *   BLOCKER 1: Tenant resolution must run AFTER auth for admin routes.
 *     A previous mounting order ran resolveTenant globally before requireAuth →
 *     JWT chưa decode khi resolve tenant → admin request có thể fallback về
 *     tenant 1 sai.
 *
 *     Fix: tách thành 2 functions:
 *       - resolveTenantFromHost  → mount BEFORE controllers cho /api/public
 *       - resolveTenantFromAuth  → mount AFTER requireAuth cho /api/admin
 *
 *   BLOCKER 2: Production không được fallback về tenant id=1 nếu không resolve.
 *     Nguy hiểm: wrong-domain.com → render default tenant → SEO disaster.
 *
 *     Fix: NODE_ENV=production → 404 Tenant Not Found.
 *          NODE_ENV=development → cho phép fallback id=1 (DX trên localhost).
 *
 * Host normalization:
 *   - lowercase
 *   - strip port
 *   - strip leading 'www.' (cả www và non-www đều match)
 */

import { tenancy, DEFAULT_TENANT_ID } from '../lib/tenancy.js';
import { TenantError, NotFoundError, ForbiddenError } from '../lib/errors.js';
import { env } from '../config/env.js';

const isProduction = () => env.NODE_ENV === 'production';

/**
 * Normalize host header thành 1 dạng để DB lookup.
 *   "WWW.Example.COM:3000" → "example.com"
 */
function normalizeHost(rawHost) {
  if (!rawHost) return null;
  let h = String(rawHost).toLowerCase().trim();
  // strip port
  h = h.split(':')[0];
  // strip leading www.
  if (h.startsWith('www.')) h = h.slice(4);
  return h || null;
}

/**
 * Public tenant resolution — qua Host header.
 *
 * Mount: app.use('/api/public', resolveTenantFromHost)
 *
 * Behavior:
 *   - Match domain trong bảng tenants (cả "example.com" và "www.example.com" đều OK)
 *   - Production: nếu không match → 404 Tenant Not Found
 *   - Development: nếu không match → fallback DEFAULT_TENANT_ID
 *
 * Inactive/suspended tenant → 404 (không expose lý do).
 */
export function resolveTenantFromHost(req, res, next) {
  try {
    const rawHost = req.headers['host'];
    const host = normalizeHost(rawHost);
    let tenant = null;

    if (host) {
      // Match cả host trực tiếp lẫn host có "www." prepended
      tenant = tenancy.byDomain(host) || tenancy.byDomain('www.' + host);
    }

    // Active check
    if (tenant && tenant.status !== 'active') tenant = null;

    // Production: KHÔNG fallback
    if (!tenant) {
      if (isProduction()) {
        return next(new NotFoundError(
          `Tenant Not Found for host "${host || '(none)'}". ` +
          'Cấu hình tenants.domain hoặc DNS để trỏ về tenant phù hợp.',
          'TENANT_NOT_FOUND'
        ));
      }
      // Dev: fallback default + log
      tenant = tenancy.byId(DEFAULT_TENANT_ID);
      if (!tenant) {
        return next(new TenantError(
          'Default tenant không tồn tại. Chạy migrations.',
          'DEFAULT_TENANT_MISSING'
        ));
      }
      // Optional dev log (1 lần per request, không spam)
      if (env.NODE_ENV !== 'test') {
        console.log(`[tenant] DEV fallback to default for host "${host || '(none)'}"`);
      }
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Admin tenant resolution — sau requireAuth.
 *
 * Mount: app.use('/api/admin', requireAuth, resolveTenantFromAuth)
 *
 * Behavior:
 *   1. req.user phải có sẵn (requireAuth đã chạy)
 *   2. Resolve tenant từ JWT.tenant_id
 *   3. Validate qua DB: tenant phải tồn tại + active
 *   4. (Future) check tenant_users mapping nếu có cross-tenant users
 *
 * Production: nếu user thiếu tenant_id hoặc invalid → 403 Forbidden.
 * Development: nếu single-tenant dev, cho phép fallback id=1.
 */
export function resolveTenantFromAuth(req, res, next) {
  try {
    if (!req.user) {
      // Phải chạy SAU requireAuth — defense-in-depth
      return next(new ForbiddenError(
        'resolveTenantFromAuth phải mount sau requireAuth',
        'MIDDLEWARE_ORDER_BUG'
      ));
    }

    let tenant = null;
    const userTenantId = req.user.tenant_id;

    if (userTenantId) {
      tenant = tenancy.byId(userTenantId);
    }

    // Active check
    if (tenant && tenant.status !== 'active') {
      return next(new ForbiddenError(
        'Tenant không còn hoạt động (đã archive/suspend).',
        'TENANT_INACTIVE'
      ));
    }

    if (!tenant) {
      if (isProduction()) {
        return next(new ForbiddenError(
          'User không gắn với tenant hợp lệ.',
          'TENANT_ACCESS_DENIED'
        ));
      }
      // Dev: only allow fallback nếu user thật sự không có tenant_id (cho old JWT pre-v1.2)
      tenant = tenancy.byId(DEFAULT_TENANT_ID);
      if (!tenant) {
        return next(new TenantError(
          'Default tenant không tồn tại. Chạy migrations.',
          'DEFAULT_TENANT_MISSING'
        ));
      }
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Legacy resolution — cho /api/* paths cũ. Kết hợp Host header + fallback dev.
 *
 * Legacy routes vẫn phải scope tenant đúng, không bypass security.
 * Production: dùng strict Host header → 404 nếu không resolve.
 * Development: fallback default.
 */
export function resolveTenantLegacy(req, res, next) {
  // Có JWT? Dùng từ JWT (admin endpoints trong legacy paths)
  if (req.user && req.user.tenant_id) {
    return resolveTenantFromAuth(req, res, next);
  }
  // Không có JWT → Host-based (public legacy)
  return resolveTenantFromHost(req, res, next);
}
