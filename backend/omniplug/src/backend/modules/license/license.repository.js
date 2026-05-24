import db from '../../../core/db/connection.js';

const upsertLicenseStmt = db.prepare(`
  INSERT INTO licenses
    (jti, raw_jwt, plan, signed_for, customer_name, customer_email,
     issued_at, expires_at, features_json, status, tenant_id)
  VALUES
    (@jti, @raw_jwt, @plan, @signed_for, @customer_name, @customer_email,
     @issued_at, @expires_at, @features_json, 'active', @tenant_id)
  ON CONFLICT(jti) DO UPDATE SET
    raw_jwt        = excluded.raw_jwt,
    plan           = excluded.plan,
    signed_for     = excluded.signed_for,
    customer_name  = excluded.customer_name,
    customer_email = excluded.customer_email,
    issued_at      = excluded.issued_at,
    expires_at     = excluded.expires_at,
    features_json  = excluded.features_json,
    status         = 'active',
    tenant_id      = excluded.tenant_id,
    updated_at     = datetime('now')
`);

export const licenseRepository = {
  findTenantDomain(tenantId) {
    return db.prepare('SELECT id, domain FROM tenants WHERE id = ?').get(tenantId);
  },

  countActivations(jti) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM license_activations WHERE jti = ?'
    ).get(jti).c;
  },

  countActivationsForOtherTenant(jti, tenantId) {
    return db.prepare(`
      SELECT COUNT(*) AS c FROM license_activations
       WHERE jti = ? AND tenant_id != ?
    `).get(jti, tenantId).c;
  },

  activate({ jwt, payload, tenantId, userId, ipAddress, userAgent, issuedAtIso, expiresAtIso }) {
    const tx = db.transaction(() => {
      upsertLicenseStmt.run({
        jti: payload.jti,
        raw_jwt: jwt,
        plan: payload.plan,
        signed_for: payload.signed_for || null,
        customer_name: payload.customer_name || '',
        customer_email: payload.customer_email || '',
        issued_at: issuedAtIso,
        expires_at: expiresAtIso,
        features_json: JSON.stringify(payload.features || {}),
        tenant_id: tenantId,
      });

      const licenseRow = db.prepare('SELECT id FROM licenses WHERE jti = ?').get(payload.jti);
      db.prepare(`
        UPDATE tenants
           SET license_id = ?,
               plan_cached = ?,
               plan_checked_at = datetime('now'),
               updated_at = datetime('now')
         WHERE id = ?
      `).run(licenseRow.id, payload.plan, tenantId);

      db.prepare(`
        INSERT INTO license_activations
          (jti, tenant_id, activated_by_user_id, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        payload.jti,
        tenantId,
        userId || null,
        ipAddress || null,
        String(userAgent || '').slice(0, 500),
      );
    });
    tx();
  },

  getStatus(tenantId) {
    return db.prepare(`
      SELECT t.id            AS tenant_id,
             t.plan_cached   AS plan,
             t.plan_checked_at,
             l.jti           AS jti,
             l.signed_for    AS signed_for,
             l.customer_name AS customer_name,
             l.expires_at    AS expires_at,
             l.status        AS license_status
        FROM tenants t
        LEFT JOIN licenses l ON l.id = t.license_id
       WHERE t.id = ?
    `).get(tenantId);
  },
};
