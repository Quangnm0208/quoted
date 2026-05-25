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
import { getProvider, getProviderForPlan } from '../providers/index.js';
import { entitlementRepo, hashLicenseKey, shortLicenseKey } from '../entitlements/entitlement.repository.js';
import { planIdFromVariantId, getPlan } from '../plans/plans.config.js';

// Default provider — used when a license has no recorded vendor (the
// common case before we add a second provider). Looking it up by id
// keeps this file vendor-agnostic. Future: persist customer_licenses.provider_id
// per row and look up here.
const DEFAULT_PROVIDER_ID = 'lemon-squeezy';

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
  const provider = getProvider(DEFAULT_PROVIDER_ID);
  if (!provider) throw err('NO_PROVIDER', 'No payment provider configured.', 500);

  // Path A: license unknown locally — try the provider directly.
  if (!license) {
    const lsRes = await provider.activateLicense({
      license_key,
      instance_name: siteInstanceName(site_url),
    });
    if (lsRes.unreachable) {
      throw err('LICENSE_NOT_YET_SYNCED', 'License not yet synced. Retry in a moment.', 503);
    }
    if (!lsRes.ok) {
      throw err('LICENSE_NOT_FOUND', 'License key not recognised.', 404, lsRes.error || null);
    }
    // Materialise locally from the provider's response. Rare in steady state —
    // webhook usually beats activate. Handles the "webhook ran late" case.
    const meta = lsRes.license_meta;
    const customer = entitlementRepo.upsertCustomerByLemon({
      email: meta.customer_email || `unknown-${meta.customer_id}@unknown.local`,
      name: meta.customer_name,
      lemon_customer_id: meta.customer_id,
    });
    const planId = planIdFromVariantId(meta.variant_id);
    if (!planId) throw err('UNKNOWN_PLAN', `Variant ${meta.variant_id} not mapped to a plan.`, 500);
    const plan = getPlan(planId);
    license = entitlementRepo.upsertLicense({
      lemon_license_id: meta.lemon_license_id,
      customer_id: customer.id,
      subscription_id: null,
      license_key_hash: hash,
      license_key_short: shortLicenseKey(license_key),
      status: meta.status,
      activation_limit: meta.activation_limit,
      instances_count: meta.activation_usage,
      expires_at: meta.expires_at,
    });
    entitlementRepo.upsertEntitlement({
      customer_id: customer.id,
      customer_license_id: license.id,
      plan_id: planId,
      feature_flags: Object.fromEntries(plan.features.map(f => [f, true])),
      quota: { tier: plan.tier, billing_cycle: plan.billing_cycle },
      status: 'active',
    });
    return finishActivation({ license, customer, planId, plan, site_url });
  }

  // Path B: known locally — gate on status + limit, then confirm with provider.
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

  const lsRes = await provider.activateLicense({
    license_key,
    instance_name: siteInstanceName(site_url),
  });
  if (lsRes.unreachable) {
    // Provider unreachable but we have local entitlement. Safer to fail
    // than to drift instances_count.
    throw err('UPSTREAM_UNAVAILABLE', 'License service unreachable. Try again shortly.', 503);
  }
  if (!lsRes.ok) {
    throw err('LICENSE_NOT_ACTIVATABLE', lsRes.error || 'License could not be activated.', 400);
  }
  entitlementRepo.incrementInstances(license.id);
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

  // Best-effort provider deactivate. Don't fail if the upstream is down —
  // the customer gets stuck otherwise. We still decrement locally.
  if (license_key) {
    const provider = getProvider(DEFAULT_PROVIDER_ID);
    if (provider) {
      await provider.deactivateLicense({
        license_key,
        instance_id: siteInstanceName(site_url),
      });
    }
  }
  entitlementRepo.decrementInstances(lic.id);
  return { ok: true };
}

// ─── helper ───────────────────────────────────────────────────────────

import db from '../../../core/db/connection.js';
function lookupLicenseById(id) {
  return db.prepare(`SELECT * FROM customer_licenses WHERE id = ?`).get(id) || null;
}
