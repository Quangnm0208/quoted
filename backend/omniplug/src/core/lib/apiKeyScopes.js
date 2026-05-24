/**
 * API key scope helpers.
 *
 * The v1.4.4 scope model moved from coarse legacy scopes (sdk/crm/webhook)
 * to route-level scopes. Keep legacy keys working without granting webhook
 * keys read access.
 */

export const API_READ_SCOPES = Object.freeze([
  'leads:read',
  'site:read',
  'articles:read',
  'projects:read',
  'pages:read',
]);

export const API_LEAD_SCOPES = Object.freeze([
  'leads:read',
  'leads:write',
]);

export const DEFAULT_API_KEY_SCOPE = Object.freeze([
  ...API_READ_SCOPES,
].join(' '));

const LEGACY_SCOPE_MAP = Object.freeze({
  sdk: API_READ_SCOPES,
  crm: API_LEAD_SCOPES,
  webhook: [],
});

const KNOWN_SCOPES = new Set([
  ...API_READ_SCOPES,
  ...API_LEAD_SCOPES,
  ...Object.keys(LEGACY_SCOPE_MAP),
]);

export function parseScopeTokens(scope) {
  return String(scope || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function expandApiKeyScopes(scope) {
  const expanded = new Set();
  for (const token of parseScopeTokens(scope)) {
    const legacy = LEGACY_SCOPE_MAP[token];
    if (legacy) {
      for (const mapped of legacy) expanded.add(mapped);
    } else if (token !== 'webhook') {
      expanded.add(token);
    }
  }
  return expanded;
}

export function validateApiKeyScopeString(scope) {
  const tokens = parseScopeTokens(scope);
  if (tokens.length === 0) {
    return { ok: false, invalid: ['(empty)'] };
  }
  const invalid = tokens.filter((token) => !KNOWN_SCOPES.has(token));
  return { ok: invalid.length === 0, invalid };
}

export function scopeUsageText() {
  return [
    DEFAULT_API_KEY_SCOPE,
    'leads:write',
    'sdk',
    'crm',
    'webhook',
  ].join(' | ');
}
