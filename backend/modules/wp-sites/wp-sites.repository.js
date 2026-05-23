/**
 * wp-sites repository — direct DB access for wp_sites table.
 *
 * Follows OmniPlug v1.4.4 pattern: lazyPrepare statements, named exports.
 *
 * @module wp-sites/repository
 */

import { getDb } from '../../../core/db/connection.js';

let stmts = null;

/**
 * Lazy prepare statements on first call. Avoids module-load DB dependency.
 */
function prepare() {
  if (stmts) return stmts;
  const db = getDb();

  stmts = {
    findById: db.prepare(`
      SELECT ws.*, t.plan
      FROM wp_sites ws
      LEFT JOIN tenants t ON t.id = ws.tenant_id
      WHERE ws.id = ?
    `),

    findByTenantDomain: db.prepare(`
      SELECT ws.*, t.plan
      FROM wp_sites ws
      LEFT JOIN tenants t ON t.id = ws.tenant_id
      WHERE ws.tenant_id = ? AND ws.domain = ?
    `),

    findByTenant: db.prepare(`
      SELECT ws.*, t.plan
      FROM wp_sites ws
      LEFT JOIN tenants t ON t.id = ws.tenant_id
      WHERE ws.tenant_id = ?
      ORDER BY ws.installed_at DESC
    `),

    findByDomain: db.prepare(`
      SELECT ws.*, t.plan
      FROM wp_sites ws
      LEFT JOIN tenants t ON t.id = ws.tenant_id
      WHERE ws.domain = ? AND ws.is_active = 1
      LIMIT 1
    `),

    insert: db.prepare(`
      INSERT INTO wp_sites
        (tenant_id, domain, site_name, admin_email, wp_version, plugin_version, last_seen_at)
      VALUES
        (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `),

    update: db.prepare(`
      UPDATE wp_sites
      SET site_name = ?,
          admin_email = ?,
          wp_version = ?,
          plugin_version = ?,
          last_seen_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          is_active = 1
      WHERE id = ?
    `),

    touch: db.prepare(`
      UPDATE wp_sites
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),

    markSynced: db.prepare(`
      UPDATE wp_sites
      SET last_sync_at = CURRENT_TIMESTAMP,
          last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),

    setNiche: db.prepare(`
      UPDATE wp_sites
      SET niche = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),
  };

  return stmts;
}

// ─── Public API ──────────────────────────────────────────────────────

export function findById(id) {
  return prepare().findById.get(id);
}

export function findByTenant(tenantId) {
  return prepare().findByTenant.all(tenantId);
}

export function findByDomain(domain) {
  return prepare().findByDomain.get(domain);
}

/**
 * Insert or update a wp_site row keyed on (tenant_id, domain).
 */
export function upsertWpSite({ tenantId, domain, siteName, adminEmail, wpVersion, pluginVersion }) {
  const s = prepare();
  const existing = s.findByTenantDomain.get(tenantId, domain);

  if (existing) {
    s.update.run(siteName, adminEmail, wpVersion, pluginVersion, existing.id);
    return s.findById.get(existing.id);
  }

  const result = s.insert.run(tenantId, domain, siteName, adminEmail, wpVersion, pluginVersion);
  return s.findById.get(result.lastInsertRowid);
}

export function touch(id) {
  prepare().touch.run(id);
}

export function markSynced(id) {
  prepare().markSynced.run(id);
}

export function setNiche(id, niche) {
  prepare().setNiche.run(niche, id);
}
