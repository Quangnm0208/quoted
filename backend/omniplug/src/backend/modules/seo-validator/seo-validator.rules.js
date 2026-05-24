/**
 * seo-validator/seo-validator.rules.js — Pure rule engine.
 *
 * Two categories of rules:
 *   - BLOCK rules: failing one prevents publish
 *   - WARN rules:  failing one reduces SEO score but allows publish
 *
 * Every rule is a pure function:
 *   (entity, opts) -> { id, severity, passed, message, weight }
 *
 * No DB access here. The validator service loads the entity + images
 * elsewhere and passes them in.
 *
 * Rule definitions follow Google Search Central guidance verified
 * 2025-2026. Where Vietnamese SEO playbook diverges from Google's
 * actual recommendations, rules are downgraded to WARN to avoid
 * blocking publish on debunked guidance (e.g. exact keyword density
 * percentages, 50KB image size cap).
 */

import { JSDOM } from 'jsdom';

// =====================================================================
// Helpers
// =====================================================================

/**
 * Count words in a string, supporting Vietnamese diacritics.
 * Strips HTML if present.
 */
export function countWords(text) {
  if (!text) return 0;
  // Remove HTML tags first
  const plain = String(text).replace(/<[^>]*>/g, ' ');
  // Split on whitespace; filter empty tokens
  const tokens = plain.split(/\s+/).filter(Boolean);
  return tokens.length;
}

/**
 * Extract plain text from HTML (no tags, normalized whitespace).
 */
export function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse content_html into a DOM for selector-based checks.
 * Returns a `document` object compatible with browser DOM.
 *
 * jsdom is heavy; we only construct it once per validation pass.
 */
export function parseDom(html) {
  if (!html) return null;
  try {
    const dom = new JSDOM('<!DOCTYPE html><html><body>' + html + '</body></html>');
    return dom.window.document;
  } catch {
    return null;
  }
}

/**
 * Case-insensitive substring search supporting Vietnamese diacritics.
 * We do NOT strip diacritics; "căn hộ" and "can ho" are different keywords.
 */
export function containsKeyword(haystack, keyword) {
  if (!haystack || !keyword) return false;
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Count occurrences of keyword in text (case-insensitive, word boundary
 * approximate — Vietnamese doesn't have strict word boundaries, so we
 * use lookahead-lookbehind for non-letter chars).
 */
export function countKeyword(text, keyword) {
  if (!text || !keyword) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the keyword surrounded by non-letter chars or string boundary.
  // Use Unicode property escapes for letter detection.
  const re = new RegExp('(?:^|[^\\p{L}])' + escaped + '(?=$|[^\\p{L}])', 'giu');
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

// =====================================================================
// Rule definitions
// =====================================================================
//
// Signature: rule(entity, opts) → ruleResult
//   entity: the article/project row with seo_* fields populated
//   opts:   {
//             images: [{ id, url, alt, width, height, byte_size }],
//             tenant: { display_name, domain },
//             internalLinkCount: number (parsed from content_html),
//             contentText: plain text version of content_html,
//             contentDom: jsdom document of content_html,
//           }
//
// ruleResult: {
//   id: 'unique-rule-id',
//   severity: 'block' | 'warn',
//   passed: boolean,
//   message: string (i18n: Vietnamese, since admin UI is Vietnamese),
//   weight: number (for score calculation; sum of weights = 100),
// }

// ---------------------------------------------------------------------
// BLOCK rules (failure prevents publish)
// ---------------------------------------------------------------------

const SLUG_VALID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function ruleSlug(entity) {
  const slug = entity.slug || '';
  const ok = slug.length > 0 && slug.length <= 80 && SLUG_VALID_REGEX.test(slug);
  return {
    id: 'slug',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'URL slug hợp lệ.'
      : 'URL slug phải viết thường, không dấu, các từ nối bằng dấu "-" và tối đa 80 ký tự.',
    weight: 8,
  };
}

export function ruleSeoTitleLength(entity) {
  const t = (entity.seo_title || entity.title || '').trim();
  const len = t.length;
  // Block if absent or wildly off; warn handles 50-60 ideal range separately
  const ok = len >= 30 && len <= 70;
  return {
    id: 'seo_title_length',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Độ dài SEO title hợp lệ (' + len + ' ký tự).'
      : 'SEO title phải có 30-70 ký tự, tối ưu 50-60. Hiện tại: ' + len + ' ký tự.',
    weight: 10,
  };
}

export function ruleSeoTitleKeywordPosition(entity) {
  const title = (entity.seo_title || entity.title || '').trim();
  const fk = (entity.focus_keyword || '').trim();
  if (!fk) {
    return {
      id: 'seo_title_keyword_position',
      severity: 'block',
      passed: false,
      message: 'Chưa có focus keyword. Cần khai báo trước khi publish.',
      weight: 8,
    };
  }
  const lowerTitle = title.toLowerCase();
  const idx = lowerTitle.indexOf(fk.toLowerCase());
  // Block: keyword phải xuất hiện trong title. Warn riêng sẽ check vị trí <=30 ký tự đầu.
  const ok = idx !== -1;
  return {
    id: 'seo_title_keyword_position',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Focus keyword có trong SEO title (vị trí ' + idx + ').'
      : 'SEO title phải chứa focus keyword "' + fk + '".',
    weight: 10,
  };
}

export function ruleSeoDescriptionLength(entity) {
  const d = (entity.seo_description || '').trim();
  const len = d.length;
  const ok = len >= 80 && len <= 170;
  return {
    id: 'seo_description_length',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Độ dài meta description hợp lệ (' + len + ' ký tự).'
      : 'Meta description phải có 80-170 ký tự, tối ưu 140-160. Hiện tại: ' + len + ' ký tự.',
    weight: 8,
  };
}

export function ruleH1Exists(_entity, opts) {
  const dom = opts.contentDom;
  if (!dom) {
    // No content yet; cannot validate
    return {
      id: 'h1_exists',
      severity: 'block',
      passed: false,
      message: 'Bài viết chưa có nội dung.',
      weight: 6,
    };
  }
  // Note: many CMS render the article title as the page H1 in the
  // frontend, so content_html itself may not contain an H1 — only H2+
  // for body sections. We accept H1 OR H2 as "the heading exists".
  // The page-level H1 is article.title; the validator below handles
  // focus-keyword-in-H1 by checking the article.title field.
  const headings = dom.querySelectorAll('h1, h2');
  const ok = headings.length > 0;
  return {
    id: 'h1_exists',
    severity: 'block',
    passed: ok,
    message: ok ? 'Có heading trong nội dung.' : 'Bài viết chưa có heading (H1/H2).',
    weight: 4,
  };
}

export function ruleH1ContainsKeyword(entity, opts) {
  const fk = (entity.focus_keyword || '').trim();
  if (!fk) {
    return {
      id: 'h1_contains_keyword',
      severity: 'block',
      passed: false,
      message: 'Chưa có focus keyword.',
      weight: 6,
    };
  }
  // Strategy: check article.title (acts as page H1) OR first H1/H2 in content_html
  const titleHasKeyword = containsKeyword(entity.title || '', fk);
  let firstHeadingHasKeyword = false;
  if (opts.contentDom) {
    const first = opts.contentDom.querySelector('h1, h2');
    if (first) firstHeadingHasKeyword = containsKeyword(first.textContent, fk);
  }
  const ok = titleHasKeyword || firstHeadingHasKeyword;
  return {
    id: 'h1_contains_keyword',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Focus keyword có trong heading chính.'
      : 'H1 (title) hoặc H2 đầu tiên phải chứa focus keyword "' + fk + '".',
    weight: 8,
  };
}

export function ruleImageCount(_entity, opts) {
  const wc = countWords(opts.contentText || '');
  const imgCount = (opts.images || []).length;
  // Tier:
  //   < 1500 words: min 3 images
  //   >= 2000 words: min 4 images
  //   1500-2000: min 3 (interpolation; lenient)
  let required = 3;
  if (wc >= 2000) required = 4;
  const ok = imgCount >= required;
  return {
    id: 'image_count',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Số lượng ảnh hợp lệ (' + imgCount + ' ảnh / yêu cầu ' + required + ').'
      : 'Bài viết ' + wc + ' từ cần tối thiểu ' + required + ' ảnh (hiện có ' + imgCount + ').',
    weight: 6,
  };
}

export function ruleAllImagesHaveAlt(_entity, opts) {
  const images = opts.images || [];
  if (images.length === 0) {
    return {
      id: 'all_images_have_alt',
      severity: 'block',
      passed: true,  // vacuously true if no images
      message: 'Không có ảnh để kiểm tra alt.',
      weight: 6,
    };
  }
  const missing = images.filter((m) => !m.alt || m.alt.trim().length === 0);
  const ok = missing.length === 0;
  return {
    id: 'all_images_have_alt',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Mọi ảnh đã có alt text.'
      : missing.length + ' ảnh thiếu alt text. Mở từng ảnh, click "Dùng gợi ý" hoặc nhập thủ công.',
    weight: 6,
  };
}

export function ruleInternalLinks(_entity, opts) {
  const count = opts.internalLinkCount || 0;
  // Vietnamese SEO playbook says 4-5; B2B reality is often 1-2. We
  // block on <2 (no internal linking strategy at all) but warn the
  // 4-5 ideal separately.
  const ok = count >= 2;
  return {
    id: 'internal_links',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Có ' + count + ' internal link trong bài.'
      : 'Cần ít nhất 2 internal link. Tốt nhất 4-5 (home, bài liên quan, URL SEO).',
    weight: 6,
  };
}

export function ruleOgImageResolved(_entity, opts) {
  // opts.ogImageResolved: { ok: bool, url, error? }
  const r = opts.ogImageResolved || { ok: false };
  return {
    id: 'og_image_resolved',
    severity: 'block',
    passed: !!r.ok,
    message: r.ok
      ? 'OG image hợp lệ (' + r.url + ').'
      : 'OG image không tồn tại hoặc trả 404. Vào tab "Hình ảnh SEO" để cấu hình.',
    weight: 6,
  };
}

export function ruleRobotsValid(entity) {
  const r = (entity.robots_directive || 'index,follow').toLowerCase();
  const validTokens = new Set([
    'index', 'noindex', 'follow', 'nofollow', 'noarchive',
    'nosnippet', 'noimageindex', 'notranslate', 'noai', 'noimageai',
    'max-snippet', 'max-image-preview', 'max-video-preview',
  ]);
  const tokens = r.split(',').map((s) => s.trim().split(':')[0]);
  const ok = tokens.length > 0 && tokens.every((t) => t === '' || validTokens.has(t));
  return {
    id: 'robots_valid',
    severity: 'block',
    passed: ok,
    message: ok
      ? 'Robots directive hợp lệ.'
      : 'Robots directive chứa giá trị không hợp lệ. Tham khảo Google Search Central.',
    weight: 4,
  };
}

// ---------------------------------------------------------------------
// WARN rules (failure reduces score, does not block publish)
// ---------------------------------------------------------------------

export function ruleTitleIdealLength(entity) {
  const len = (entity.seo_title || entity.title || '').trim().length;
  const ok = len >= 50 && len <= 60;
  return {
    id: 'title_ideal_length',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'SEO title trong khoảng tối ưu 50-60 ký tự.'
      : 'SEO title tối ưu là 50-60 ký tự (đặc biệt 55). Hiện tại: ' + len + '.',
    weight: 3,
  };
}

export function ruleTitleKeywordEarly(entity) {
  const title = (entity.seo_title || entity.title || '').toLowerCase();
  const fk = (entity.focus_keyword || '').toLowerCase();
  if (!fk || !title.includes(fk)) {
    return {
      id: 'title_keyword_early',
      severity: 'warn',
      passed: false,
      message: 'Focus keyword nên nằm trong 30 ký tự đầu của title.',
      weight: 2,
    };
  }
  const idx = title.indexOf(fk);
  const ok = idx >= 0 && idx <= 30;
  return {
    id: 'title_keyword_early',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Focus keyword nằm sớm trong title (vị trí ' + idx + ').'
      : 'Focus keyword nên nằm trong 30 ký tự đầu (hiện vị trí ' + idx + ').',
    weight: 2,
  };
}

export function ruleSapoHasKeyword(entity, opts) {
  const fk = (entity.focus_keyword || '').trim();
  const text = opts.contentText || '';
  if (!fk || !text) {
    return {
      id: 'sapo_has_keyword',
      severity: 'warn',
      passed: false,
      message: 'Sapo (100 từ đầu) nên chứa focus keyword.',
      weight: 3,
    };
  }
  const firstWords = text.split(/\s+/).slice(0, 100).join(' ');
  const ok = containsKeyword(firstWords, fk);
  return {
    id: 'sapo_has_keyword',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Sapo có focus keyword.'
      : 'Sapo (100 từ đầu) nên chứa focus keyword "' + fk + '".',
    weight: 3,
  };
}

export function ruleConclusionHasKeyword(entity, opts) {
  const fk = (entity.focus_keyword || '').trim();
  const text = opts.contentText || '';
  if (!fk || !text) {
    return {
      id: 'conclusion_has_keyword',
      severity: 'warn',
      passed: false,
      message: 'Kết bài (100 từ cuối) nên chứa focus keyword.',
      weight: 2,
    };
  }
  const tokens = text.split(/\s+/);
  const lastWords = tokens.slice(Math.max(0, tokens.length - 100)).join(' ');
  const ok = containsKeyword(lastWords, fk);
  return {
    id: 'conclusion_has_keyword',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Kết bài có focus keyword.'
      : 'Kết bài (100 từ cuối) nên chứa focus keyword "' + fk + '".',
    weight: 2,
  };
}

export function ruleContentLength(_entity, opts) {
  const wc = countWords(opts.contentText || '');
  // Google does not have a hard length rule. Vietnamese consultants
  // say 1000-2000. We warn if <600 (clearly thin) or >5000 (likely
  // walls of text that hurt readability).
  const ok = wc >= 600 && wc <= 5000;
  return {
    id: 'content_length',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Độ dài bài viết hợp lý (' + wc + ' từ).'
      : 'Bài có ' + wc + ' từ. Mục tiêu: 1000-2000 từ cho informational; tránh dưới 600 hoặc trên 5000.',
    weight: 3,
  };
}

export function ruleKeywordDensity(entity, opts) {
  // We track this for transparency, but do NOT enforce a percentage.
  // Google's John Mueller has repeatedly confirmed there is no magic
  // density. Forced density looks like spam to Google's NLP.
  const fk = (entity.focus_keyword || '').trim();
  const text = opts.contentText || '';
  if (!fk || !text) {
    return {
      id: 'keyword_density',
      severity: 'warn',
      passed: true, // pass-through
      message: 'Chưa có focus keyword hoặc nội dung để đo mật độ.',
      weight: 1,
    };
  }
  const wc = countWords(text);
  if (wc < 50) {
    return {
      id: 'keyword_density',
      severity: 'warn',
      passed: true,
      message: 'Nội dung quá ngắn để đo mật độ.',
      weight: 1,
    };
  }
  const occurrences = countKeyword(text, fk);
  const density = (occurrences * fk.split(/\s+/).length) / wc * 100;
  // Warn only if extreme: <0.3% (probably forgot) or >5% (stuffing).
  const ok = density >= 0.3 && density <= 5;
  return {
    id: 'keyword_density',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Mật độ keyword ' + density.toFixed(2) + '% (lành mạnh).'
      : 'Mật độ keyword ' + density.toFixed(2) + '%. Tự nhiên là dưới 5% và trên 0.3%.',
    weight: 2,
  };
}

export function ruleH2HasSecondary(entity, opts) {
  const secondary = (() => {
    try {
      const arr = JSON.parse(entity.secondary_keywords || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  })();
  if (secondary.length === 0 || !opts.contentDom) {
    return {
      id: 'h2_has_secondary',
      severity: 'warn',
      passed: true,
      message: 'Không có secondary keyword để kiểm tra.',
      weight: 1,
    };
  }
  const headings = opts.contentDom.querySelectorAll('h2, h3, h4, h5, h6');
  if (headings.length === 0) {
    return {
      id: 'h2_has_secondary',
      severity: 'warn',
      passed: false,
      message: 'Chưa có heading H2-H6 để chèn secondary keyword.',
      weight: 2,
    };
  }
  // Pass if any heading contains any secondary keyword
  const headingText = Array.from(headings).map((h) => h.textContent).join(' ');
  const hit = secondary.some((kw) => containsKeyword(headingText, kw));
  return {
    id: 'h2_has_secondary',
    severity: 'warn',
    passed: hit,
    message: hit
      ? 'Có secondary keyword trong H2-H6.'
      : 'H2-H6 nên chứa ít nhất 1 secondary keyword.',
    weight: 2,
  };
}

export function ruleImageAltLength(_entity, opts) {
  const images = opts.images || [];
  const tooLong = images.filter((m) => m.alt && m.alt.length > 125);
  const ok = tooLong.length === 0;
  return {
    id: 'image_alt_length',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Alt text các ảnh trong giới hạn 125 ký tự.'
      : tooLong.length + ' ảnh có alt text dài hơn 125 ký tự (Google effective limit).',
    weight: 2,
  };
}

export function ruleImageSizeReasonable(_entity, opts) {
  const images = opts.images || [];
  if (images.length === 0) {
    return {
      id: 'image_size_reasonable',
      severity: 'warn',
      passed: true,
      message: 'Không có ảnh để kiểm tra.',
      weight: 1,
    };
  }
  // Warn if any image > 500KB. Block threshold (>2MB) is separate
  // upload-time validation handled by media module.
  const heavy = images.filter((m) => (m.byte_size || 0) > 500 * 1024);
  const ok = heavy.length === 0;
  return {
    id: 'image_size_reasonable',
    severity: 'warn',
    passed: ok,
    message: ok
      ? 'Mọi ảnh dưới 500KB.'
      : heavy.length + ' ảnh trên 500KB. Cân nhắc convert WebP/AVIF + resize.',
    weight: 2,
  };
}

// =====================================================================
// Rule registry — order matters only for display
// =====================================================================

export const BLOCK_RULES = [
  ruleSlug,
  ruleSeoTitleLength,
  ruleSeoTitleKeywordPosition,
  ruleSeoDescriptionLength,
  ruleH1Exists,
  ruleH1ContainsKeyword,
  ruleImageCount,
  ruleAllImagesHaveAlt,
  ruleInternalLinks,
  ruleOgImageResolved,
  ruleRobotsValid,
];

export const WARN_RULES = [
  ruleTitleIdealLength,
  ruleTitleKeywordEarly,
  ruleSapoHasKeyword,
  ruleConclusionHasKeyword,
  ruleContentLength,
  ruleKeywordDensity,
  ruleH2HasSecondary,
  ruleImageAltLength,
  ruleImageSizeReasonable,
];

export const ALL_RULES = [...BLOCK_RULES, ...WARN_RULES];

// =====================================================================
// Runner
// =====================================================================

export function runRules(entity, opts) {
  const results = [];
  for (const rule of ALL_RULES) {
    try {
      results.push(rule(entity, opts));
    } catch (err) {
      results.push({
        id: rule.name,
        severity: 'warn',
        passed: false,
        message: 'Rule lỗi: ' + err.message,
        weight: 1,
      });
    }
  }
  // Compute score: sum(weight * passed) / sum(weight) * 100
  const totalWeight = results.reduce((s, r) => s + (r.weight || 0), 0);
  const earnedWeight = results.reduce((s, r) => s + ((r.passed && r.weight) || 0), 0);
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const blockers = results.filter((r) => r.severity === 'block' && !r.passed);
  const warnings = results.filter((r) => r.severity === 'warn' && !r.passed);
  const passed = results.filter((r) => r.passed);
  return {
    score,
    can_publish: blockers.length === 0,
    blockers,
    warnings,
    passed,
    all: results,
  };
}
