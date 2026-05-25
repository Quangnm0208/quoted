/**
 * Quoted-side tenant resolver.
 *
 * OmniPlug's core/lib/tenancy.js exposes lookup-only helpers (byDomain,
 * byId, bySlug). The Quoted plugin needs an "upsert" — find the tenant for
 * this WP site's domain, or create one on the fly during /wp-sites/register.
 *
 * We do not modify the tenants table schema. We do attach plan + license_jti
 * to the wp_sites row instead (see migration 025).
 */

import db from '../../../../core/db/connection.js';
import { tenancy } from '../../../../core/lib/tenancy.js';

function slugifyDomain(domain) {
  return String(domain)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `t-${Date.now().toString(36)}`;
}

const _insertTenant = db.prepare(`
  INSERT INTO tenants (slug, name, domain, status, settings_json)
  VALUES (?, ?, ?, 'active', '{}')
`);

const _findBySlug = db.prepare('SELECT * FROM tenants WHERE slug = ?');

/**
 * Find tenant by normalized domain; create if absent.
 * `name` defaults to the domain itself. `slug` is derived from the domain
 * (unique-suffixed if it collides).
 */
export function resolveOrCreateTenant({ domain, name }) {
  const normalizedDomain = String(domain).toLowerCase().replace(/^www\./, '').trim();
  const existing = tenancy.byDomain(normalizedDomain);
  if (existing) return existing;

  let slug = slugifyDomain(normalizedDomain);
  let attempt = 0;
  while (_findBySlug.get(slug)) {
    attempt++;
    slug = `${slugifyDomain(normalizedDomain)}-${attempt}`;
  }

  const info = _insertTenant.run(
    slug,
    name || normalizedDomain,
    normalizedDomain,
  );
  return tenancy.byId(info.lastInsertRowid);
}
