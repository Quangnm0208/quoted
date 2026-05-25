/**
 * customers + orders + subscriptions + customer_licenses + entitlements
 * repository — the commercial layer's data access.
 *
 * Co-located in one file because they're tightly coupled (almost every
 * webhook handler touches 3-4 of these tables in one transaction). Splitting
 * into 5 files would obscure the orchestration without value.
 */

import crypto from 'node:crypto';
import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  // customers — two-step upsert because we have two unique keys (email +
  // lemon_customer_id) and SQLite's ON CONFLICT can only target one. The
  // service calls find-by-lemon-id, then find-by-email, then insert/update
  // explicitly. See `upsertCustomerByLemon` in the exported repo below.
  insertCustomer: db.prepare(`
    INSERT INTO customers (email, name, lemon_customer_id)
    VALUES (@email, @name, @lemon_customer_id)
  `),
  updateCustomer: db.prepare(`
    UPDATE customers SET
      email = @email,
      name = COALESCE(@name, name),
      lemon_customer_id = COALESCE(@lemon_customer_id, lemon_customer_id),
      updated_at = datetime('now')
    WHERE id = @id
  `),
  findCustomerByEmail:   db.prepare(`SELECT * FROM customers WHERE email = ? COLLATE NOCASE`),
  findCustomerByLemonId: db.prepare(`SELECT * FROM customers WHERE lemon_customer_id = ?`),

  // orders
  upsertOrder: db.prepare(`
    INSERT INTO orders (lemon_order_id, customer_id, amount_cents, currency, status, raw_payload)
    VALUES (@lemon_order_id, @customer_id, @amount_cents, @currency, @status, @raw_payload)
    ON CONFLICT(lemon_order_id) DO UPDATE SET
      status = excluded.status,
      amount_cents = excluded.amount_cents,
      raw_payload = excluded.raw_payload
  `),

  // subscriptions
  upsertSubscription: db.prepare(`
    INSERT INTO subscriptions
      (lemon_subscription_id, customer_id, plan_id, status, renews_at, ends_at,
       trial_ends_at, update_payment_url, raw_payload)
    VALUES
      (@lemon_subscription_id, @customer_id, @plan_id, @status, @renews_at, @ends_at,
       @trial_ends_at, @update_payment_url, @raw_payload)
    ON CONFLICT(lemon_subscription_id) DO UPDATE SET
      status = excluded.status,
      plan_id = excluded.plan_id,
      renews_at = excluded.renews_at,
      ends_at = excluded.ends_at,
      trial_ends_at = excluded.trial_ends_at,
      update_payment_url = excluded.update_payment_url,
      raw_payload = excluded.raw_payload,
      updated_at = datetime('now')
  `),
  findSubscriptionByLemonId: db.prepare(`SELECT * FROM subscriptions WHERE lemon_subscription_id = ?`),

  // customer_licenses
  upsertLicense: db.prepare(`
    INSERT INTO customer_licenses
      (lemon_license_id, customer_id, subscription_id, license_key_hash, license_key_short,
       status, activation_limit, instances_count, expires_at)
    VALUES
      (@lemon_license_id, @customer_id, @subscription_id, @license_key_hash, @license_key_short,
       @status, @activation_limit, @instances_count, @expires_at)
    ON CONFLICT(lemon_license_id) DO UPDATE SET
      status = excluded.status,
      activation_limit = excluded.activation_limit,
      instances_count = excluded.instances_count,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `),
  findLicenseByHash:    db.prepare(`SELECT * FROM customer_licenses WHERE license_key_hash = ?`),
  findLicenseByLemonId: db.prepare(`SELECT * FROM customer_licenses WHERE lemon_license_id = ?`),
  incrementInstances:   db.prepare(`UPDATE customer_licenses SET instances_count = instances_count + 1, updated_at = datetime('now') WHERE id = ?`),
  decrementInstances:   db.prepare(`UPDATE customer_licenses SET instances_count = MAX(0, instances_count - 1), updated_at = datetime('now') WHERE id = ?`),

  // entitlements
  upsertEntitlement: db.prepare(`
    INSERT INTO entitlements (customer_id, customer_license_id, plan_id, feature_flags_json, quota_json, status, source)
    VALUES (@customer_id, @customer_license_id, @plan_id, @feature_flags_json, @quota_json, @status, @source)
    ON CONFLICT(customer_id, customer_license_id) DO UPDATE SET
      plan_id = excluded.plan_id,
      feature_flags_json = excluded.feature_flags_json,
      quota_json = excluded.quota_json,
      status = excluded.status,
      updated_at = datetime('now')
  `),
  findEntitlementByLicense: db.prepare(`
    SELECT * FROM entitlements WHERE customer_license_id = ? LIMIT 1
  `),
  updateEntitlementStatus: db.prepare(`
    UPDATE entitlements SET status = ?, updated_at = datetime('now') WHERE customer_license_id = ?
  `),
}));

export function hashLicenseKey(uuid) {
  return crypto.createHash('sha256').update(String(uuid).trim().toLowerCase()).digest('hex');
}

export function shortLicenseKey(uuid) {
  const trimmed = String(uuid).trim();
  return trimmed.length > 8 ? trimmed.slice(0, 8) + '…' : trimmed;
}

export const entitlementRepo = {
  /**
   * Upsert with dual-key conflict resolution (email + lemon_customer_id).
   * Resolution priority: lemon_customer_id (if present) > email.
   * - Existing row by lemon_customer_id → update email + name.
   * - Else existing row by email → update name + lemon_customer_id.
   * - Else insert.
   */
  upsertCustomerByLemon(data) {
    const s = stmt();
    const email = String(data.email).toLowerCase();
    const fields = {
      email,
      name: data.name || null,
      lemon_customer_id: data.lemon_customer_id || null,
    };

    let existing = null;
    if (fields.lemon_customer_id != null) {
      existing = s.findCustomerByLemonId.get(fields.lemon_customer_id);
    }
    if (!existing) {
      existing = s.findCustomerByEmail.get(email);
    }

    if (existing) {
      s.updateCustomer.run({ id: existing.id, ...fields });
      return s.findCustomerByEmail.get(fields.email);
    }
    const info = s.insertCustomer.run(fields);
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(info.lastInsertRowid);
  },

  findCustomerByEmail(email) {
    return stmt().findCustomerByEmail.get(email) || null;
  },

  upsertOrder(data) { stmt().upsertOrder.run(data); },

  upsertSubscription(data) {
    stmt().upsertSubscription.run(data);
    return stmt().findSubscriptionByLemonId.get(data.lemon_subscription_id);
  },

  findSubscriptionByLemonId(id) {
    return stmt().findSubscriptionByLemonId.get(id) || null;
  },

  upsertLicense(data) {
    stmt().upsertLicense.run(data);
    return stmt().findLicenseByLemonId.get(data.lemon_license_id);
  },

  findLicenseByHash(hash)       { return stmt().findLicenseByHash.get(hash) || null; },
  findLicenseByLemonId(lemonId) { return stmt().findLicenseByLemonId.get(lemonId) || null; },
  incrementInstances(id)        { stmt().incrementInstances.run(id); },
  decrementInstances(id)        { stmt().decrementInstances.run(id); },

  upsertEntitlement(data) {
    stmt().upsertEntitlement.run({
      customer_id: data.customer_id,
      customer_license_id: data.customer_license_id,
      plan_id: data.plan_id,
      feature_flags_json: JSON.stringify(data.feature_flags || {}),
      quota_json: JSON.stringify(data.quota || {}),
      status: data.status,
      source: data.source || 'lemonsqueezy',
    });
    return stmt().findEntitlementByLicense.get(data.customer_license_id);
  },

  findEntitlementByLicense(licenseId) {
    return stmt().findEntitlementByLicense.get(licenseId) || null;
  },

  setEntitlementStatus(licenseId, status) {
    stmt().updateEntitlementStatus.run(status, licenseId);
  },
};
