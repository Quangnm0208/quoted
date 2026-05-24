import db from '../../../core/db/connection.js';
import { lazyPrepare } from '../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  list: db.prepare('SELECT * FROM tenants ORDER BY id ASC'),
  findById: db.prepare('SELECT * FROM tenants WHERE id = ?'),
  findBySlug: db.prepare('SELECT id FROM tenants WHERE slug = ?'),
  insert: db.prepare(`
    INSERT INTO tenants (slug, name, domain, status, settings_json)
    VALUES (@slug, @name, @domain, @status, @settings_json)
  `),
  update: db.prepare(`
    UPDATE tenants SET
      name = @name,
      domain = @domain,
      status = @status,
      settings_json = @settings_json,
      updated_at = datetime('now')
    WHERE id = @id
  `),
}));

export const tenantsRepository = {
  list() {
    return stmt().list.all();
  },

  findById(id) {
    return stmt().findById.get(id) || null;
  },

  findBySlug(slug) {
    return stmt().findBySlug.get(slug) || null;
  },

  create(data) {
    return stmt().insert.run(data);
  },

  update(data) {
    return stmt().update.run(data);
  },
};
