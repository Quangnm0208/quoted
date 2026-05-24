/**
 * cms-integration.js — Snippet để legacy landing page gọi legacy API.
 *
 * Cách dùng:
 *   1. Copy file này vào legacy/public/assets/cms-integration.js
 *   2. Thêm vào legacy/templates/index.html.tpl trước </body>:
 *        <script>window.CMS_API_URL = 'https://your-cms.fly.dev';</script>
 *        <script src="assets/cms-integration.js" defer></script>
 *   3. Trên HTML, đánh dấu element cần dynamic update:
 *        <h1 data-cms="hero.title">Default text</h1>
 *        <a data-cms-attr-href="tel:hotline" href="tel:0900000000">Gọi ngay</a>
 *
 * Behavior:
 *   - Trang vẫn render text default ngay lập tức (SEO + no-flash)
 *   - Background: fetch /api/site, swap content vào DOM
 *   - Articles (nếu có element [data-cms-articles]): render list
 *   - Cache 60s với SWR pattern
 */

(function () {
  'use strict';

  const API = window.CMS_API_URL;
  if (!API) {
    console.warn('[cms] window.CMS_API_URL not set — skip dynamic content');
    return;
  }

  const SWR_KEY = 'omniplug_cms_site_cache';
  const SWR_TTL = 60_000; // 60s

  // ---- Step 1: Đọc cache (instant render) ----
  let cached = null;
  try {
    const raw = sessionStorage.getItem(SWR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.fetched_at < SWR_TTL * 5) {
        cached = parsed.data;
        applySiteConfig(cached);
      }
    }
  } catch (_) { /* ignore */ }

  // ---- Step 2: Fetch fresh từ API ----
  fetch(API.replace(/\/+$/, '') + '/api/site', { credentials: 'omit' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(data => {
      try { sessionStorage.setItem(SWR_KEY, JSON.stringify({ fetched_at: Date.now(), data })); }
      catch (_) {}
      applySiteConfig(data);
    })
    .catch(err => {
      console.warn('[cms] Site config fetch failed; using static fallbacks', err.message);
    });

  // ---- Step 3: Load articles nếu page yêu cầu ----
  const articleList = document.querySelector('[data-cms-articles]');
  if (articleList) {
    loadArticles(articleList);
  }

  /**
   * Apply site config keys vào DOM.
   *
   * Markup patterns supported:
   *   <span data-cms="hero.title">          — set textContent
   *   <img  data-cms-attr-src="hero.image"> — set src attribute
   *   <a    data-cms-attr-href="tel:hotline" href="...">  — set href (with prefix)
   *   <span data-cms-html="article.body">   — set innerHTML (CHỈ dùng cho HTML đã trusted!)
   */
  function applySiteConfig(config) {
    // Plain text
    document.querySelectorAll('[data-cms]').forEach(el => {
      const key = el.getAttribute('data-cms');
      const v = config[key];
      if (v !== undefined && v !== null) el.textContent = String(v);
    });

    // Inner HTML (TRUST risk — chỉ dùng cho nội dung admin tạo)
    document.querySelectorAll('[data-cms-html]').forEach(el => {
      const key = el.getAttribute('data-cms-html');
      const v = config[key];
      if (typeof v !== 'string') return;
      // Belt-and-suspenders: strip scripts + event handlers truoc khi inject.
      // Server-side sanitize da chay (sanitizeArticleHtml). Day la defense-in-depth.
      try {
        const tmp = document.createElement('div');
        tmp.innerHTML = v;
        tmp.querySelectorAll('script,style,link,iframe,object,embed').forEach(n => n.remove());
        tmp.querySelectorAll('*').forEach(n => {
          for (const attr of [...n.attributes]) {
            if (/^on/i.test(attr.name)) n.removeAttribute(attr.name);
          }
        });
        el.innerHTML = tmp.innerHTML;
      } catch {
        el.textContent = v;
      }
    });

    // Attributes: data-cms-attr-<ATTR>="key" hoặc "prefix:key"
    document.querySelectorAll('*').forEach(el => {
      for (const attr of el.attributes) {
        if (!attr.name.startsWith('data-cms-attr-')) continue;
        const targetAttr = attr.name.slice('data-cms-attr-'.length);
        let value = attr.value;
        let prefix = '';
        if (value.startsWith('tel:')) { prefix = 'tel:'; value = value.slice(4); }
        else if (value.startsWith('mailto:')) { prefix = 'mailto:'; value = value.slice(7); }

        const v = config[value];
        if (v !== undefined && v !== null) {
          let final = String(v);
          if (prefix === 'tel:') final = prefix + final.replace(/\s+/g, '');
          else if (prefix) final = prefix + final;
          el.setAttribute(targetAttr, final);
        }
      }
    });
  }

  /**
   * Render danh sách bài viết vào [data-cms-articles].
   */
  async function loadArticles(container) {
    const limit = parseInt(container.getAttribute('data-cms-limit'), 10) || 5;
    container.innerHTML = '<p style="color:#888">Đang tải bài viết...</p>';
    try {
      const r = await fetch(API.replace(/\/+$/, '') + '/api/articles?limit=' + limit, { credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!data.rows.length) {
        container.innerHTML = '<p style="color:#888">Chưa có bài viết nào.</p>';
        return;
      }
      container.innerHTML = data.rows.map(a => `
        <article class="cms-article-card">
          ${a.cover_image ? `<img src="${escAttr(a.cover_image.url)}" alt="${escAttr(a.title)}" loading="lazy">` : ''}
          <h3><a href="/blog/${escAttr(a.slug)}">${esc(a.title)}</a></h3>
          ${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ''}
          <p class="cms-article-date">${formatDate(a.published_at || a.created_at)}</p>
        </article>
      `).join('');
    } catch (e) {
      container.innerHTML = '<p style="color:#888">Không tải được bài viết.</p>';
      console.warn('[cms] loadArticles failed', e);
    }
  }

  // --- helpers ---
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escAttr(s) { return esc(s); }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }
})();
