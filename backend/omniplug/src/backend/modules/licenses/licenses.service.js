/**
 * Licenses service — activate / validate / deactivate.
 *
 * Flow per /activate:
 *   1. Hash the supplied license_key — look up customer_licenses by hash.
 *   2. If not in our DB → either webhook hasn't arrived yet OR the key is
 *      fake. Try the LS License API to disambiguate:
 *        - LS says valid + active → write license + entitlement, continue.
 *        - LS says invalid       → 404 LICENSE_NOT_FOUND.
 *        - LS unreachable        → 503 LICENSE_NOT_YET_SYNCED so plugin retries.
 *   3. If in our DB:
 *        - Check status (active/expired/disabled) + activation_limit.
 *        - Call LS /licenses/activate to register the instance — this is
 *          the source of truth for instances_count.
 *        - On LS success: increment our instances_count + mint our
 *          activation_token JWT carrying customer_id + license_id + plan.
 *
 * The activation_token is the bearer the plugin uses for /validate and
 * /deactivate. It's our own HS256 JWT (so the plugin never needs LS keys).
 */

import jwt from 'jsonwebtoken';
import { env } from '../../../core/config/env.js';
import { callLicenseApi } from '../payments/lemon-squeezy.client.js';
import { entitlementRepo, hashLicenseKey, shortLicenseKey } from '../payments/entitlement.repository.js';
import { planIdFromVariantId, getPlan } from '../payments/plans.config.js';

const ACTIVATION_TOKEN_TTL = 24 * 3600;  // 24h — plugin re-validates daily

function err(code, message, httpStatus = 400, details = null) {
  const e = new Error(message);
  e.code = code;
  e.httpStatus = httpStatus;
  e.details = details;
  return e;
}

function siteInstanceName(siteUrl) {
  // LS uses instance_name to identify each activation. We use the site URL
  // so the customer's LS dashboard shows readable site names.
  return String(siteUrl).replace(/^https?:\/\//, '').replace(/\/+$/, '').slice(0, 200);
}

function mintActivationToken({ customerId, licenseId, planId, siteUrl }) {
  return jwt.sign(
    {
      sub: `license:${licenseId}`,
      customer_id: customerId,
      license_id: licenseId,
      plan_id: planId,
      site_url: siteUrl,
    },
    env.JWT_SECRET,
    { expiresIn: ACTIVATION_TOKEN_TTL },
  );
}

export function decodeActivationToken(token) {
  try { return jwt.verify(token, env.JWT_SECRET); }
  catch { return null; }
}

// ─── activate ─────────────────────────────────────────────────────────

export async function activate({ license_key, site_url, plugin_version, wp_version }) {
  const hash = hashLicenseKey(license_key);
  let license = entitlementRepo.findLicenseByHash(hash);

  // Path A: license unknown locally — try LS.
  if (!license) {
    const lsRes = await callLicenseApi('/licenses/activate', {
      license_key,
      instance_name: siteInstanceName(site_url),
    });
    if (lsRes.status === 0) {
      // LS unreachable. Webhook may arrive shortly with the license_key_created event.
      throw err('LICENSE_NOT_YET_SYNCED', 'License not yet synced. Retry in a moment.', 503);
    }
    if (!lsRes.ok || !lsRes.body?.activated) {
      throw err('LICENSE_NOT_FOUND', 'License key not recognised.', 404, lsRes.body?.error || null);
    }
    // Materialise locally from LS response. This rarely runs in steady state —
    // webhook usually beats activate. But it handles the "webhook ran late" case.
    const lsLicense = lsRes.body.license_key;
    const lsMeta    = lsRes.body.meta;
    const lemonCustomerId = lsMeta?.customer_id;
    const customer = entitlementRepo.upsertCustomerByLemon({
      email: lsMeta?.customer_email || `unknown-${lemonCustomerId}@unknown.local`,
      name: lsMeta?.customer_name,
      lemon_customer_id: lemonCustomerId,
    });
    const variantId = lsMeta?.variant_id;
    const planId = planIdFromVariantId(variantId);
    if (!planId) throw err('UNKNOWN_PLAN', `Variant ${variantId} not mapped to a plan.`, 500);
    const plan = getPlan(planId);
    license = entitlementRepo.upsertLicense({
      lemon_license_id: lsLicense.id,
      customer_id: customer.id,
      subscription_id: null,
      license_key_hash: hash,
      license_key_short: shortLicenseKey(license_key),
      status: lsLicense.status || 'active',
      activation_limit: lsLicense.activation_limit || 1,
      instances_count: lsLicense.activation_usage || 0,
      expires_at: lsLicense.expires_at || null,
    });
    entitlementRepo.upsertEntitlement({
      customer_id: customer.id,
      customer_license_id: license.id,
      plan_id: planId,
      feature_flags: Object.fromEntries(plan.features.map(f => [f, true])),
      quota: { tier: plan.tier, billing_cycle: plan.billing_cycle },
      status: 'active',
    });
    // LS already incremented instances_count on its side; mirror locally.
    return finishActivation({ license, customer, planId, plan, site_url });
  }

  // Path B: known locally — gate on status + limit, then call LS.
  if (license.status === 'disabled') {
    throw err('LICENSE_DISABLED', 'License has been disabled.', 410);
  }
  if (license.status === 'expired') {
    throw err('LICENSE_EXPIRED', 'License has expired.', 410);
  }
  if (license.instances_count >= license.activation_limit) {
    throw err(
      'ACTIVATION_LIMIT_REACHED',
      `License is in use on ${license.instances_count}/${license.activation_limit} sites.`,
      403,
    );
  }

  const lsRes = await callLicenseApi('/licenses/activate', {
    license_key,
    instance_name: siteInstanceName(site_url),
  });
  if (lsRes.status === 0) {
    // LS unreachable but we have local entitlement. We could grant offline,
    // but then instances_count drifts. Safer to fail.
    throw err('UPSTREAM_UNAVAILABLE', 'License service unreachable. Try again shortly.', 503);
  }
  if (!lsRes.ok || !lsRes.body?.activated) {
    throw err('LICENSE_NOT_ACTIVATABLE', lsRes.body?.error || 'License could not be activated.', 400, lsRes.body);
  }
  entitlementRepo.incrementInstances(license.id);
  // Reload the updated row.
  license = entitlementRepo.findLicenseByHash(hash);

  const customer = { id: license.customer_id };
  const entitlement = entitlementRepo.findEntitlementByLicense(license.id);
  if (!entitlement) throw err('NO_ENTITLEMENT', 'License has no entitlement record.', 500);
  const plan = getPlan(entitlement.plan_id);

  return finishActivation({ license, customer, planId: entitlement.plan_id, plan, site_url });
}

function finishActivation({ license, customer, planId, plan, site_url }) {
  const token = mintActivationToken({
    customerId: customer.id,
    licenseId: license.id,
    planId,
    siteUrl: site_url,
  });
  return {
    activation_token: token,
    plan: planId,
    plan_tier: plan?.tier || 'unknown',
    features: plan ? Object.fromEntries(plan.features.map(f => [f, true])) : {},
    expires_at: license.expires_at,
    activation_limit: license.activation_limit,
    instances_count: license.instances_count,
  };
}

// ─── validate ─────────────────────────────────────────────────────────

export function validate({ token, site_url }) {
  const claims = decodeActivationToken(token);
  if (!claims) throw err('TOKEN_INVALID', 'Activation token invalid or expired.', 401);

  const license = entitlementRepo.findLicenseByLemonId
    ? null  // (kept for future)
    : null;
  // Look up by license_id from token.
  const lic = lookupLicenseById(claims.license_id);
  if (!lic) throw err('LICENSE_NOT_FOUND', 'License no longer exists.', 404);

  if (lic.status === 'disabled') throw err('LICENSE_DISABLED', 'License has been disabled.', 410);
  if (lic.status === 'expired')  throw err('LICENSE_EXPIRED', 'License has expired.', 410);

  const entitlement = entitlementRepo.findEntitlementByLicense(lic.id);
  if (!entitlement || entitlement.status !== 'active') {
    throw err('ENTITLEMENT_INACTIVE', 'Subscription is not active.', 410);
  }

  return {
    status: 'active',
    plan: entitlement.plan_id,
    features: JSON.parse(entitlement.feature_flags_json || '{}'),
    last_sync_at: lic.updated_at,
    site_url,
  };
}

// ─── deactivate ───────────────────────────────────────────────────────

export async function deactivate({ token, site_url, license_key }) {
  const claims = decodeActivationToken(token);
  if (!claims) throw err('TOKEN_INVALID', 'Activation token invalid or expired.', 401);

  const lic = lookupLicenseById(claims.license_id);
  if (!lic) return { ok: true };  // already gone

  // Best-effort LS deactivate. Don't fail if LS is down — the customer
  // gets stuck otherwise. We still decrement locally.
  if (license_key) {
    await callLicenseApi('/licenses/deactivate', {
      license_key,
      instance_id: siteInstanceName(site_url),
    });
  }
  entitlementRepo.decrementInstances(lic.id);
  return { ok: true };
}

// ─── helper ───────────────────────────────────────────────────────────

import db from '../../../core/db/connection.js';
function lookupLicenseById(id) {
  return db.prepare(`SELECT * FROM customer_licenses WHERE id = ?`).get(id) || null;
}
