/**
 * core/lib/domain.js — Hostname normalization helpers.
 *
 * Single source of truth cho domain comparison (license activation,
 * tenant lookup, host resolution). Tránh diverge giữa license.controller
 * và tenants.controller.
 *
 * Rules:
 *   - accept plain hosts or full URLs
 *   - lowercase
 *   - strip leading 'www.'
 *   - strip port/path/query/hash
 *   - reject empty/non-host values like "http" or "https"
 */
export function normalizeDomain(s) {
  const raw = String(s || '').trim().toLowerCase();
  if (!raw) return '';

  let hostname = '';
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`http://${raw}`);
    hostname = url.hostname;
  } catch {
    return '';
  }

  hostname = hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  return isValidHostname(hostname) ? hostname : '';
}

export function isValidHostname(hostname) {
  if (!hostname || hostname.length > 253) return false;
  if (hostname === 'localhost') return true;

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return hostname.split('.').every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }

  if (!hostname.includes('.')) return false;
  return hostname.split('.').every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
  );
}
