/**
 * core/lib/apiKeyMint.js — Mint + parse + verify API keys.
 *
 * Format:
 *   op_live_<8-char-public-prefix>_<32-char-secret>
 *
 * The prefix is stored plaintext in api_keys.key_prefix (UNIQUE indexed).
 * The secret is bcrypt-hashed into api_keys.key_hash (NEVER indexed).
 *
 * Lookup at request time:
 *   1. Parse header → { prefix, secret }
 *   2. SELECT key_hash FROM api_keys WHERE key_prefix = ?  // O(log n)
 *   3. bcrypt.compare(secret, key_hash)                    // O(2^rounds)
 *
 * Why bcrypt over SHA256+salt: developer keys leak to GitHub all the
 * time. A 5-cost bcrypt makes a leaked DB worth ~30 days of cracking
 * vs ~30 seconds for SHA256. Cost-benefit beats throughput here.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const PREFIX_LEN = 8;
const SECRET_LEN = 32;
const FULL_LEN = 'op_live_'.length + PREFIX_LEN + 1 + SECRET_LEN;  // 49
const BCRYPT_ROUNDS = 10;

const PUBLIC_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
//                   ^ removed: I O 0 1 l (visually ambiguous)

function randomFromAlphabet(n, alphabet) {
  // Use rejection sampling for unbiased pick — Math.random NOT used.
  const out = [];
  const bytes = crypto.randomBytes(n * 2);
  let i = 0;
  for (const byte of bytes) {
    if (out.length === n) break;
    // Map byte → index. Reject if it falls in the bias zone.
    const max = Math.floor(256 / alphabet.length) * alphabet.length;
    if (byte >= max) continue;
    out.push(alphabet[byte % alphabet.length]);
    i++;
  }
  if (out.length < n) {
    // Extremely rare top-up
    return out.join('') + randomFromAlphabet(n - out.length, alphabet);
  }
  return out.join('');
}

/**
 * Mint a new key. Returns { prefix, secret, full, hash } — caller is
 * responsible for storing `prefix` + `hash` in api_keys, and showing
 * `full` to the operator ONCE (never again).
 */
export function mintApiKey() {
  const prefix = randomFromAlphabet(PREFIX_LEN, PUBLIC_CHARS);
  const secret = randomFromAlphabet(SECRET_LEN, PUBLIC_CHARS);
  const full = `op_live_${prefix}_${secret}`;
  const hash = bcrypt.hashSync(secret, BCRYPT_ROUNDS);
  return { prefix, secret, full, hash };
}

/**
 * Parse a header value. Returns { prefix, secret } or null if malformed.
 * Constant-shape parsing — no early-exit on length so timing leaks
 * are minimal (the bcrypt step dwarfs this anyway).
 */
export function parseApiKeyHeader(headerValue) {
  if (typeof headerValue !== 'string') return null;
  if (headerValue.length !== FULL_LEN) return null;
  if (!headerValue.startsWith('op_live_')) return null;
  const rest = headerValue.slice('op_live_'.length);
  // rest = "<8>_<32>"
  if (rest.length !== PREFIX_LEN + 1 + SECRET_LEN) return null;
  if (rest[PREFIX_LEN] !== '_') return null;
  const prefix = rest.slice(0, PREFIX_LEN);
  const secret = rest.slice(PREFIX_LEN + 1);
  // Both must be PUBLIC_CHARS — defensive check
  if (!/^[A-HJ-NP-Za-hj-km-np-z2-9]+$/.test(prefix)) return null;
  if (!/^[A-HJ-NP-Za-hj-km-np-z2-9]+$/.test(secret)) return null;
  return { prefix, secret };
}

/**
 * Async verify. ALWAYS uses bcrypt.compare so timing is constant —
 * caller passes a real hash on hit, or DUMMY_HASH on miss. See SEC-1.
 */
export async function verifyApiKey(secret, keyHash) {
  if (typeof secret !== 'string' || typeof keyHash !== 'string') return false;
  try {
    return await bcrypt.compare(secret, keyHash);
  } catch {
    return false;
  }
}

/**
 * Dummy hash — bcrypt-shaped string of cost 10 that always fails compare.
 * Pre-computed once at module load to avoid leaking timing on cold start.
 * SEC-1: middleware calls bcrypt.compare on this when the prefix doesn't
 * exist, so the response time matches the happy path.
 */
export const DUMMY_HASH = bcrypt.hashSync('dummy-not-a-real-secret', BCRYPT_ROUNDS);

/**
 * Sleep helper used by middleware to pad short-circuit timing to match
 * bcrypt's natural latency.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
