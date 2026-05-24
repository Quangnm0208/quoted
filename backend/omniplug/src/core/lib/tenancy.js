/**
 * core/tenancy.js — Central tenant context.
 *
 * Tenancy strategy: SHARED-SCHEMA, ROW-LEVEL.
 *   Mỗi data row có `tenant_id`. Queries luôn filter `WHERE tenant_id = ?`.
 *
 * Tenant resolution order (xem middleware/tenant.js):
 *   1. JWT payload (admin routes) — req.user.tenant_id
 *   2. Host header lookup (public routes) — tenants.domain match
 *   3. Fallback DEFAULT_TENANT_ID (= 1)
 *
 * Repository contract:
 *   Mọi repository PHẢI accept tenantId argument đầu tiên (hoặc dùng req.tenantId).
 *   Mọi INSERT phải set tenant_id.
 *   Mọi SELECT/UPDATE/DELETE phải WHERE tenant_id = ?.
 *
 * Defense-in-depth: ngay cả nếu controller quên check, FK CASCADE + UNIQUE(tenant_id, slug)
 * không cho data leak giữa tenants.
 */

import db from '../db/connection.js';

export const DEFAULT_TENANT_ID = 1;

// Lazy-initialized prepared statements (startup hardening).
// Top-level db.prepare() crashes if schema not yet migrated.
// stmt() defers prepare until first call (after migrations are guaranteed run).
let _stmt = null;
function stmt() {
  if (_stmt) return _stmt;
  _stmt = {
  findById:     db.prepare('SELECT * FROM tenants WHERE id = ?'),
  findBySlug:   db.prepare('SELECT * FROM tenants WHERE slug = ?'),
  findByDomain: db.prepare("SELECT * FROM tenants WHERE domain = ? COLLATE NOCASE AND status = 'active'"),
  listActive:   db.prepare("SELECT * FROM tenants WHERE status = 'active' ORDER BY id ASC"),
  listAll:      db.prepare('SELECT * FROM tenants ORDER BY id ASC'),
};
  return _stmt;
}

/** Lookup tenant theo các cách. Return null nếu không tìm thấy hoặc inactive. */
export const tenancy = {
  byId(id) {
    if (!id) return null;
    return stmt().findById.get(id) || null;
  },

  bySlug(slug) {
    if (!slug) return null;
    return stmt().findBySlug.get(slug) || null;
  },

  byDomain(domain) {
    if (!domain) return null;
    // Strip port if any
    const host = String(domain).split(':')[0].toLowerCase().trim();
    if (!host) return null;
    return stmt().findByDomain.get(host) || null;
  },

  listActive() {
    return stmt().listActive.all();
  },

  listAll() {
    return stmt().listAll.all();
  },

  /** Default tenant — luôn tồn tại sau migration 005. */
  default() {
    return this.byId(DEFAULT_TENANT_ID);
  },
};

/**
 * Helper: lấy tenantId từ req.
 * Bắt buộc gọi sau middleware/tenant.js đã set req.tenantId.
 *
 * Throws nếu chưa được resolve → bug logic, phải fail loud.
 */
export function getTenantId(req) {
  if (!req || typeof req.tenantId !== 'number') {
    throw new Error('Tenant context not resolved. Did you forget tenant middleware?');
  }
  return req.tenantId;
}
