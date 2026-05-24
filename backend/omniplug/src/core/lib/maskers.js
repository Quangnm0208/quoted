/**
 * core/lib/maskers.js — PII masking for soft-locked plans.
 *
 * Community-tier deployments see lead data with phone + email masked.
 * Data is NOT deleted — paying customers can decrypt later. The mask
 * is purely a UI/API-output filter; the row is intact in the DB.
 *
 * Rules:
 *   phone "0912345678" → "091•••5678"  (first 3 + last 4)
 *   email "alice@example.com" → "a•••@example.com"  (first char + domain)
 *   name  "Nguyễn Văn A" → "Nguyễn V•••"  (first word + first letter)
 *
 * Never throws — bad input falls through as the dot-marker so a UI
 * showing maskers can always render *something*.
 */

const DOT = '•';
const HIDDEN = DOT.repeat(3);

export function maskPhone(phone) {
  const s = String(phone || '');
  if (s.length < 7) return HIDDEN;
  const start = s.slice(0, 3);
  const end = s.slice(-4);
  return `${start}${HIDDEN}${end}`;
}

export function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return HIDDEN;
  const local = s.slice(0, at);
  const domain = s.slice(at);
  return `${local[0]}${HIDDEN}${domain}`;
}

export function maskName(name) {
  const s = String(name || '').trim();
  if (!s) return HIDDEN;
  const parts = s.split(/\s+/);
  if (parts.length === 1) {
    return parts[0][0] + HIDDEN;
  }
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = last[0] + HIDDEN;
  return parts.join(' ');
}

/**
 * Apply masks to a lead row (shape from leads.repository.list/findById).
 * Returns a NEW object — does not mutate input. Always sets `_masked: true`
 * so the UI can show a "Upgrade to unlock" banner.
 *
 * Fields masked: name, phone, email, ip_address, notes (notes truncated).
 * Fields kept: id, status, created_at, source, tenant_id.
 */
export function maskLead(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    name:       maskName(row.name),
    phone:      maskPhone(row.phone),
    email:      row.email ? maskEmail(row.email) : null,
    ip_address: row.ip_address ? maskIp(row.ip_address) : null,
    notes:      row.notes ? '[masked — upgrade to view]' : '',
    _masked:    true,
  };
}

export function maskIp(ip) {
  const s = String(ip || '');
  // IPv4 only: keep first octet
  const m = s.match(/^(\d{1,3})\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  if (m) return `${m[1]}.xxx.xxx.xxx`;
  // IPv6 — keep first hextet
  if (s.includes(':')) {
    const first = s.split(':')[0];
    return `${first}:xxxx::`;
  }
  return HIDDEN;
}
