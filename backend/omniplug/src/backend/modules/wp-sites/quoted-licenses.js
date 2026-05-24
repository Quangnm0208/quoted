/**
 * Quoted license envelope + JWT helpers.
 *
 * The WP plugin issues license keys in the envelope form
 *   `qtd_live_<base64url-jwt>`  (or `qtd_test_…` in non-prod).
 * Inside the envelope is a standard OmniPlug license JWT (RS256 or ES384,
 * signed by the operator key at LICENSE_PUBLIC_KEY_PATH).
 *
 * The base64url body is the JWT itself, so the envelope is just the prefix +
 * `<header>.<payload>.<signature>` directly — base64url already covers `-` and
 * `_`; we only also need to allow `.` for the segment separators.
 *
 * The plugin-side JWT (mint by signPluginJwt) is a separate, server-issued
 * HS256 token used as the Bearer for all subsequent /api/v1/wp-sites/*,
 * bot-crawls, citations, live-test calls.
 */

import jwt from 'jsonwebtoken';
import { verifyLicense } from '../../../core/lib/licenseKey.js';
import { env } from '../../../core/config/env.js';

const ENVELOPE_RE = /^qtd_(live|test)_([A-Za-z0-9_.-]+)$/;

/**
 * Strip the qtd_live_/qtd_test_ envelope, verify the inner JWT against the
 * operator public key, and return the decoded claims.
 *
 * Throws an Error with .code = INVALID_LICENSE_FORMAT | INVALID_LICENSE_SIGNATURE
 * | LICENSE_EXPIRED on failure.
 */
export function verifyQuotedLicense(envelopeKey) {
  const match = ENVELOPE_RE.exec(String(envelopeKey || ''));
  if (!match) {
    const e = new Error('License key format is invalid.');
    e.code = 'INVALID_LICENSE_FORMAT';
    e.httpStatus = 400;
    throw e;
  }
  const [, , innerJwt] = match;
  try {
    return verifyLicense(innerJwt);
  } catch (err) {
    const e = new Error('License signature verification failed.');
    e.code = err.code === 'LICENSE_EXPIRED' ? 'LICENSE_EXPIRED' : 'INVALID_LICENSE_SIGNATURE';
    e.httpStatus = err.code === 'LICENSE_EXPIRED' ? 410 : 400;
    e.cause = err;
    throw e;
  }
}

/**
 * v1.4.4 CRL is signed externally and re-imported via op-license-reimport.js.
 * For Phase 0 local dev we do not maintain a separate quoted CRL — the upstream
 * `verifyLicense` already throws LICENSE_EXPIRED on `exp`. Return false (i.e.
 * not revoked) as the stub; replace when a quoted-specific CRL is shipped.
 */
export function isQuotedLicenseRevoked(_jti) {
  return false;
}

/**
 * Mint the plugin-side JWT (Bearer for /api/v1 plugin endpoints).
 * Separate from OmniPlug's `signToken` because the payload shape is different
 * (we carry tenant_id, wp_site_id, plan, domain — not the user/email/role shape).
 */
export function signPluginJwt(payload, ttlSeconds) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ttlSeconds });
}
