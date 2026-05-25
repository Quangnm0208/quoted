/**
 * cms.js — Marketing-site → OmniPlug page_sections hydration.
 *
 * Static HTML is the fallback; this helper only OVERWRITES copy when the
 * CMS API returns a matching section. If JS is disabled, the API is
 * unreachable, the page_key is empty, or a section_key is missing, the
 * page keeps its build-time copy and stays usable.
 *
 * Markup contract (set in each *.html):
 *
 *   <h1 data-cms="hero.title">When customers ask AI...</h1>
 *   <p  data-cms="hero.subtitle">Quoted is a small WordPress plugin...</p>
 *   <a  data-cms="hero.cta_primary_label"
 *       data-cms-href="hero.cta_primary_url"
 *       href="https://wordpress.org/plugins/quoted/">Install free plugin</a>
 *
 * `data-cms="<section_key>.<field>"`        → element.textContent = value
 * `data-cms-href="<section_key>.<field>"`   → element.href = value
 * `data-cms-src="<section_key>.<field>"`    → element.src = value
 * `data-cms-alt="<section_key>.<field>"`    → element.alt = value
 *
 * Field lookup order, given `hero.cta_primary_label`:
 *   1. section.title / section.subtitle  (the two first-class columns)
 *   2. section.payload.cta_primary_label  (the flexible JSON blob)
 *
 * We deliberately DO NOT use innerHTML — a compromised CMS row must not
 * be able to inject script into the marketing site. Rich inline markup
 * stays in HTML as a static fallback.
 */

(function () {
  'use strict';

  // ── Resolve API base ────────────────────────────────────────────────
  //
  // Order of precedence:
  //   1. <meta name="quoted-cms-api" content="https://api.quotedeasy.com">
  //   2. window.QUOTED_CMS_API_BASE  (set inline before this script)
  //   3. http://127.0.0.1:4000 when served from a dev port (:5500 / :3000 etc.)
  //   4. window.location.origin     (same-origin deploy — e.g. backend serves the site)
  function resolveApiBase() {
    var meta = document.querySelector('meta[name="quoted-cms-api"]');
    if (meta && meta.content) return meta.content.replace(/\/+$/, '');
    if (typeof window.QUOTED_CMS_API_BASE === 'string' && window.QUOTED_CMS_API_BASE) {
      return window.QUOTED_CMS_API_BASE.replace(/\/+$/, '');
    }
    var devPorts = ['3000', '5173', '5500', '8080'];
    if (window.location.protocol.startsWith('http') && devPorts.indexOf(window.location.port) !== -1) {
      return 'http://127.0.0.1:4000';
    }
    return window.location.origin;
  }

  function getPageKey() {
    var body = document.body;
    if (body && body.dataset && body.dataset.cmsPage) return body.dataset.cmsPage;
    var meta = document.querySelector('meta[name="quoted-cms-page"]');
    if (meta && meta.content) return meta.content;
    return '';
  }

  // ── Field lookup ────────────────────────────────────────────────────
  function pickField(section, field) {
    if (!section) return null;
    if (field === 'title') return section.title || null;
    if (field === 'subtitle') return section.subtitle || null;
    if (section.payload && Object.prototype.hasOwnProperty.call(section.payload, field)) {
      return section.payload[field];
    }
    return null;
  }

  // ── Apply one attribute ─────────────────────────────────────────────
  function applyTextContent(el, value) {
    if (value == null) return;
    el.textContent = String(value);
  }

  function applyAttr(el, attr, value) {
    if (value == null) return;
    var str = String(value);
    // Block javascript:/data: URLs on href/src attrs — basic safety net even
    // though the API is admin-authored.
    if ((attr === 'href' || attr === 'src')) {
      var lower = str.trim().toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('data:')) return;
    }
    el.setAttribute(attr, str);
  }

  function hydrateElement(el, sectionsByKey) {
    var bind = el.getAttribute('data-cms');
    if (bind) {
      var parts = bind.split('.');
      if (parts.length === 2) {
        applyTextContent(el, pickField(sectionsByKey[parts[0]], parts[1]));
      }
    }
    var attrs = ['href', 'src', 'alt'];
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      var bound = el.getAttribute('data-cms-' + a);
      if (bound) {
        var p = bound.split('.');
        if (p.length === 2) applyAttr(el, a, pickField(sectionsByKey[p[0]], p[1]));
      }
    }
  }

  // ── Main ───────────────────────────────────────────────────────────
  function hydrate() {
    var pageKey = getPageKey();
    if (!pageKey) return;
    var base = resolveApiBase();
    var url = base + '/api/public/pages/' + encodeURIComponent(pageKey);

    // 5s budget — never let CMS latency block the marketing render.
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 5000);

    fetch(url, { method: 'GET', signal: controller ? controller.signal : undefined })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('cms http ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.sections)) return;
        var sectionsByKey = {};
        for (var i = 0; i < data.sections.length; i++) {
          var s = data.sections[i];
          if (s && s.key) sectionsByKey[s.key] = s;
        }
        var nodes = document.querySelectorAll('[data-cms],[data-cms-href],[data-cms-src],[data-cms-alt]');
        for (var j = 0; j < nodes.length; j++) hydrateElement(nodes[j], sectionsByKey);
      })
      .catch(function (err) {
        // Fail-safe: keep static fallback copy. Log once in dev so the
        // operator can spot bad keys / CORS / network without crashing.
        if (window.console && window.location.hostname.match(/(localhost|127\.0\.0\.1)/)) {
          window.console.warn('[quoted-cms] hydration skipped:', err && err.message);
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  } else {
    hydrate();
  }
})();
