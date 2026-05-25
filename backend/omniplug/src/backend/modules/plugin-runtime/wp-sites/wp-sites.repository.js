/**
 * wp-sites repository — direct DB access for wp_sites table.
 *
 * tenant_id is INTEGER (matches OmniPlug tenants(id)).
 * plan + license_jti live on wp_sites itself (we do not extend the upstream
 * tenants schema — see migration 025).
 */

import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  findById: db.prepare(`SELECT * FROM wp_sites WHERE id = ?`),

  findByTenantDomain: db.prepare(`
    SELECT * FROM wp_sites WHERE tenant_id = ? AND domain = ?
  `),

  findByTenant: db.prepare(`
    SELECT * FROM wp_sites WHERE tenant_id = ? ORDER BY installed_at DESC
  `),

  findByDomain: db.prepare(`
    SELECT * FROM wp_sites WHERE domain = ? AND is_active = 1 LIMIT 1
  `),

  insert: db.prepare(`
    INSERT INTO wp_sites
      (tenant_id, domain, site_name, admin_email, wp_version, plugin_version,
       plan, license_jti, customer_id, customer_license_id, last_seen_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `),

  update: db.prepare(`
    UPDATE wp_sites SET
      site_name = ?,
      admin_email = ?,
      wp_version = ?,
      plugin_version = ?,
      plan = ?,
      license_jti = ?,
      customer_id = ?,
      customer_license_id = ?,
      last_seen_at = datetime('now'),
      updated_at = datetime('now'),
      is_active = 1
    WHERE id = ?
  `),

  touch: db.prepare(`UPDATE wp_sites SET last_seen_at = datetime('now') WHERE id = ?`),

  markSynced: db.prepare(`
    UPDATE wp_sites
    SET last_sync_at = datetime('now'), last_seen_at = datetime('now')
    WHERE id = ?
  `),

  setNiche: db.prepare(`
    UPDATE wp_sites SET niche = ?, updated_at = datetime('now') WHERE id = ?
  `),
}));

export function findById(id) {
  return stmt().findById.get(id) || null;
}

export function findByTenant(tenantId) {
  return stmt().findByTenant.all(tenantId);
}

export function findByDomain(domain) {
  return stmt().findByDomain.get(domain) || null;
}

/**
 * Insert or update a wp_site row keyed on (tenant_id, domain).
 */
export function upsertWpSite({
  tenantId, domain, siteName, adminEmail, wpVersion, pluginVersion,
  plan = 'free', licenseJti = null, customerId = null, customerLicenseId = null,
}) {
  const s = stmt();
  const existing = s.findByTenantDomain.get(tenantId, domain);

  if (existing) {
    s.update.run(
      siteName, adminEmail, wpVersion, pluginVersion, plan, licenseJti,
      customerId, customerLicenseId, existing.id,
    );
    return s.findById.get(existing.id);
  }

  const result = s.insert.run(
    tenantId, domain, siteName, adminEmail, wpVersion, pluginVersion, plan, licenseJti,
    customerId, customerLicenseId,
  );
  return s.findById.get(result.lastInsertRowid);
}

export function touch(id) {
  stmt().touch.run(id);
}

export function markSynced(id) {
  stmt().markSynced.run(id);
}

/**
 * Set the site's niche (used by Phase 3 niche benchmark). Not called yet
 * by the WP plugin — the onboarding step that captures niche is Phase 1.
 */
export function setNiche(id, niche) {
  stmt().setNiche.run(niche, id);
}
