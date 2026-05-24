/**
 * utils/slug.js — Convert Vietnamese text to URL-safe slug.
 *
 * Handle các trường hợp:
 *  - Bỏ dấu tiếng Việt (đ → d, ầ → a, etc.)
 *  - Lowercase
 *  - Replace non-alphanumeric → dash
 *  - Trim multiple dashes
 *  - Max 80 ký tự để slug không quá dài
 *
 * Note: slug-collision phải được service layer xử lý (append -1, -2, ...).
 */

const VI_MAP = {
  'à':'a','á':'a','ạ':'a','ả':'a','ã':'a','â':'a','ầ':'a','ấ':'a','ậ':'a','ẩ':'a','ẫ':'a','ă':'a','ằ':'a','ắ':'a','ặ':'a','ẳ':'a','ẵ':'a',
  'è':'e','é':'e','ẹ':'e','ẻ':'e','ẽ':'e','ê':'e','ề':'e','ế':'e','ệ':'e','ể':'e','ễ':'e',
  'ì':'i','í':'i','ị':'i','ỉ':'i','ĩ':'i',
  'ò':'o','ó':'o','ọ':'o','ỏ':'o','õ':'o','ô':'o','ồ':'o','ố':'o','ộ':'o','ổ':'o','ỗ':'o','ơ':'o','ờ':'o','ớ':'o','ợ':'o','ở':'o','ỡ':'o',
  'ù':'u','ú':'u','ụ':'u','ủ':'u','ũ':'u','ư':'u','ừ':'u','ứ':'u','ự':'u','ử':'u','ữ':'u',
  'ỳ':'y','ý':'y','ỵ':'y','ỷ':'y','ỹ':'y',
  'đ':'d',
};

export function slugify(str, maxLen = 80) {
  if (typeof str !== 'string' || !str) return '';
  let s = str.toLowerCase();
  // Strip Vietnamese diacritics
  s = s.replace(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, (c) => VI_MAP[c] || c);
  // Replace anything non a-z 0-9 with dash
  s = s.replace(/[^a-z0-9]+/g, '-');
  // Trim leading/trailing dashes
  s = s.replace(/^-+|-+$/g, '');
  // Max length
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+$/g, '');
  return s;
}

/**
 * Đảm bảo slug unique trong 1 set hiện có. Append -2, -3, ... nếu trùng.
 *
 * @param {string} baseSlug   — slug gốc từ slugify()
 * @param {function} exists   — function(slug) => boolean, true nếu đã tồn tại trong DB
 * @returns {string} unique slug
 */
export function ensureUniqueSlug(baseSlug, exists) {
  if (!baseSlug) baseSlug = 'untitled';
  if (!exists(baseSlug)) return baseSlug;
  for (let n = 2; n < 1000; n++) {
    const candidate = baseSlug + '-' + n;
    if (!exists(candidate)) return candidate;
  }
  // Fallback rất hiếm — append timestamp
  return baseSlug + '-' + Date.now();
}
