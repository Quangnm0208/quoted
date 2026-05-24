import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  findAll: db.prepare(`
    SELECT config_key, config_value, label, description, updated_at
    FROM site_config
    WHERE tenant_id = ?
    ORDER BY config_key
  `),
  findOne: db.prepare(`
    SELECT config_key, config_value, label, description, updated_at
    FROM site_config
    WHERE tenant_id = ? AND config_key = ?
  `),
  upsert: db.prepare(`
    INSERT INTO site_config (tenant_id, config_key, config_value, label, description, updated_by, updated_at)
    VALUES (@tenant_id, @key, @value, @label, @description, @updated_by, datetime('now'))
    ON CONFLICT(tenant_id, config_key) DO UPDATE SET
      config_value = excluded.config_value,
      updated_by = excluded.updated_by,
      updated_at = datetime('now')
  `),
}));

function requireTenant(tenantId) {
  if (typeof tenantId !== 'number') throw new Error('site.repository: tenantId required');
  return tenantId;
}

export const siteRepository = {
  findAll(tenantId) {
    return stmt().findAll.all(requireTenant(tenantId));
  },

  findOne(tenantId, key) {
    return stmt().findOne.get(requireTenant(tenantId), key) || null;
  },

  upsert({ tenantId, key, value, label = '', description = '', updatedBy }) {
    return stmt().upsert.run({
      tenant_id: requireTenant(tenantId),
      key,
      value,
      label,
      description,
      updated_by: updatedBy,
    });
  },
};
