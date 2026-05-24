/**
 * core/sanitize.js — HTML sanitization cho content trước khi lưu DB.
 *
 * Whitelist tags + attributes — bất kỳ thẻ/attr nào không trong list sẽ bị strip.
 * Đặc biệt block:
 *   - <script>, <iframe>, <embed>, <object>
 *   - onclick, onerror, onload (event handlers)
 *   - javascript: URL trong href/src
 *   - data:text/html URL (XSS vector)
 *
 * Strategy: sanitize on WRITE (lúc lưu DB) — đảm bảo DB không bao giờ chứa unsafe HTML.
 * Defense-in-depth: nếu frontend cũng sanitize trước render, tốt hơn nữa.
 */

import sanitizeHtml from 'sanitize-html';

// Cấu hình cho article content_html — đủ rich cho blog post nhưng safe.
const ARTICLE_CONFIG = {
  allowedTags: [
    // Block-level
    'p', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'hr',
    // Lists
    'ul', 'ol', 'li',
    // Inline
    'strong', 'em', 'u', 's', 'code', 'br',
    // Links + media
    'a', 'img', 'figure', 'figcaption',
    // Table (nhẹ)
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    'a':       ['href', 'title', 'target', 'rel'],
    'img':     ['src', 'alt', 'title', 'width', 'height', 'loading'],
    'figure':  ['class'],
    '*':       [], // không cho phép attribute nào khác trên tag khác
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],   // KHÔNG cho javascript:
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'], // data: cho phép cho img (base64 embed nếu cần)
  },
  // Cho phép data URI nhưng chỉ image/jpeg|png|webp|gif — không cho text/html
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  transformTags: {
    // Tự thêm rel="noopener noreferrer" cho external links
    'a': (tagName, attribs) => {
      if (attribs.target === '_blank') {
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName, attribs };
    },
    // Force img lazy-loading
    'img': (tagName, attribs) => {
      attribs.loading = 'lazy';
      // Nếu src là data: URL, chỉ cho phép image MIME
      if (attribs.src && attribs.src.startsWith('data:')) {
        if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(attribs.src)) {
          delete attribs.src;
        }
      }
      return { tagName, attribs };
    },
  },
};

// Cấu hình cho excerpt — text-only, không HTML
const TEXT_ONLY = {
  allowedTags: [],
  allowedAttributes: {},
};

/**
 * Sanitize HTML từ article rich text editor.
 *
 * @param {string} dirty   — HTML từ user
 * @returns {string} sanitized HTML
 */
export function sanitizeArticleHtml(dirty) {
  if (typeof dirty !== 'string') return '';
  return sanitizeHtml(dirty, ARTICLE_CONFIG);
}

/**
 * Strip all HTML, return plain text.
 * Dùng cho excerpt, meta_description nếu user paste rich text.
 */
export function stripHtml(dirty) {
  if (typeof dirty !== 'string') return '';
  return sanitizeHtml(dirty, TEXT_ONLY);
}
