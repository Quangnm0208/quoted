/**
 * media-seo/media-seo.service.js — Alt text suggestion + validation.
 *
 * Pure functions only — no DB writes here. The existing media module
 * calls these helpers at upload time and write the result to the
 * media.alt_suggested column (added in migration 013).
 *
 * Why pure: testable in isolation, no race conditions, no need for a
 * separate repository file. The media module remains the single owner
 * of the media table.
 *
 * Why not auto-fill alt directly:
 *   Auto-filled alt text is often called "generic" by Google's SEO
 *   guidelines (https://developers.google.com/search/docs/appearance/google-images
 *   — "Avoid generic alt text"). If we silently fill alt with
 *   "FUTA-Kim-An-001.jpg" we hurt SEO rather than help. So we:
 *     1. Suggest at upload time → alt_suggested column populated
 *     2. Show suggestion in admin UI with [Accept] / [Edit] / [Skip]
 *     3. Block publish if any visible image still has missing alt
 *
 * The admin user retains agency. Suggestion is a 1-click accept.
 */

/**
 * Suggest alt text for an image based on its filename and tenant context.
 *
 * Input filename "2026-05-14-the-rivers-mat-bang.webp" + tenant "FUTA"
 *   → "The Rivers mặt bằng - FUTA"
 *
 * Heuristics:
 *   1. Strip date prefix (YYYY-MM-DD-)
 *   2. Strip random suffix (8+ hex chars before extension)
 *   3. Strip extension
 *   4. Replace dashes/underscores with spaces
 *   5. Capitalize first letter of each word
 *   6. Append " - <tenant name>" if non-empty
 *
 * Returns empty string if no meaningful name can be extracted (eg.
 * filename is purely random hex like "abc123def456.jpg").
 */
export function suggestAlt(filename, tenantName) {
  if (!filename || typeof filename !== 'string') return '';

  let base = filename;

  // Strip directory if any.
  const lastSlash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
  if (lastSlash >= 0) base = base.slice(lastSlash + 1);

  // Strip extension.
  const dotIdx = base.lastIndexOf('.');
  if (dotIdx > 0) base = base.slice(0, dotIdx);

  // Strip ISO date prefix "YYYY-MM-DD-" or "YYYY-MM-DD_".
  base = base.replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/, '');

  // Strip trailing 6+ char hex hash (eg "-a1b2c3d4").
  base = base.replace(/[-_][a-f0-9]{6,}$/i, '');

  // Replace separators with spaces.
  base = base.replace(/[-_]+/g, ' ').trim();

  // Reject if too short or all-hex (random-named file).
  if (base.length < 3) return '';
  if (/^[a-f0-9\s]+$/i.test(base) && base.replace(/\s/g, '').length > 10) return '';

  // Title-case each word but preserve Vietnamese diacritics.
  base = base.replace(/\b(\w)(\S*)/g, (_m, head, rest) => {
    return head.toUpperCase() + rest;
  });

  if (tenantName && typeof tenantName === 'string' && tenantName.length > 0) {
    base = base + ' - ' + tenantName.trim();
  }

  // Cap length at 125 chars (Google's effective alt limit).
  if (base.length > 125) base = base.slice(0, 122) + '...';

  return base;
}

/**
 * Decide the alt_status value for a given alt + suggestion pair.
 *
 *   ''                  → 'missing'
 *   suggestion verbatim → 'auto'    (admin clicked "Accept")
 *   anything else       → 'manual'  (admin typed their own)
 */
export function classifyAltStatus(alt, suggested) {
  if (!alt || alt.trim() === '') return 'missing';
  if (suggested && alt.trim() === suggested.trim()) return 'auto';
  return 'manual';
}

/**
 * Validation: should the media be allowed to be referenced by a
 * publishable entity? Returns { ok, reason }.
 *
 * Called from content services before transitioning
 * to published status. If alt is missing on a visible image, publish is
 * blocked with a clear error.
 *
 * The caller is responsible for invoking this on the actual images
 * referenced by the post (cover_media_id + content_html parsed images +
 * gallery). The function itself is per-image.
 */
export function validateForPublish(media) {
  if (!media) return { ok: true };
  if (media.alt && media.alt.trim().length > 0) return { ok: true };
  return {
    ok: false,
    reason: 'IMAGE_ALT_REQUIRED',
    message: 'Ảnh "' + (media.original_name || media.filename) +
             '" chưa có alt text. Click vào ảnh để chỉnh sửa hoặc dùng gợi ý.',
  };
}

export const mediaSeoService = {
  suggestAlt,
  classifyAltStatus,
  validateForPublish,
};
