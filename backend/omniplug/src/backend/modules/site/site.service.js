import { ValidationError } from '../../../core/lib/errors.js';
import { siteRepository } from './site.repository.js';

function parseValue(rawJson) {
  try { return JSON.parse(rawJson); } catch { return rawJson; }
}

function decorateRow(row) {
  return {
    key: row.config_key,
    value: parseValue(row.config_value),
    label: row.label,
    description: row.description,
    updated_at: row.updated_at,
  };
}

export const siteService = {
  getPublicMap(tenantId) {
    const out = {};
    for (const row of siteRepository.findAll(tenantId)) {
      out[row.config_key] = parseValue(row.config_value);
    }
    return out;
  },

  getAdminList(tenantId) {
    return siteRepository.findAll(tenantId).map(decorateRow);
  },

  getOne(tenantId, key) {
    const row = siteRepository.findOne(tenantId, key);
    return row ? decorateRow(row) : null;
  },

  upsert(tenantId, key, value, userId, label = '', description = '') {
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
      throw new ValidationError('Invalid key');
    }
    siteRepository.upsert({
      tenantId,
      key,
      value: JSON.stringify(value),
      label,
      description,
      updatedBy: userId,
    });
    return this.getOne(tenantId, key);
  },
};
