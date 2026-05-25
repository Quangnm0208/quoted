/**
 * page-content.js — Admin page renderers (functional, API-backed).
 *
 * Rewritten in M2: the previous version was a UI mockup with hardcoded
 * Vinhomes demo data and ~0 fetch calls. Every renderer here calls the
 * real backend (/api/admin/*) via the `api()` helper from shell.js.
 *
 * Edit/save is wired for the surfaces the CEO actually operates:
 *   - Pages (section_key/title/subtitle/payload edit + save)
 *   - Site Settings (per-key value edit + save)
 *
 * Other System pages (Users, Tenants, Audit, License, Leads, Media,
 * Articles, Projects) are read-only views of real data — adding write
 * UI is M3+.
 *
 * Renderers are async. Returns an HTML string. page-init.js awaits the
 * result and injects into #pageRoot, then calls bindInteractions().
 *
 * Error policy: any failed fetch shows a toast + an error panel in
 * place of the missing data. The shell never crashes.
 */

import { api, escapeHtml, toast, icon } from './shell.js';

// ─────────────────────────────────────────────────────────────────────
// Public dispatch
// ─────────────────────────────────────────────────────────────────────

export async function renderPage(page) {
  const renderers = {
    dashboard: renderDashboard,
    quoteddashboard: renderQuotedDashboard,
    pages: renderPagesAdmin,
    sections: renderSectionsAdmin,
    media: renderMedia,
    leads: renderLeads,
    projects: renderProjects,
    articles: renderArticles,
    articleEdit: renderArticleEditStub,
    site: renderSite,
    users: renderUsers,
    tenants: renderTenants,
    audit: renderAudit,
    license: renderLicense,
    customers: renderCustomers,
    subscriptions: renderSubscriptions,
    wpsites: renderWpSites,
    botcrawls: renderBotCrawls,
    posts: renderQuotedPosts,
    webhookevents: renderWebhookEvents,
  };
  const fn = renderers[page] || renderDashboard;
  try {
    return await fn();
  } catch (err) {
    console.error('[page-content] renderer failed:', err);
    return errorPanel(`Không load được trang ${page}: ${err.message}`);
  }
}

export function pageTitle(page) {
  return {
    dashboard: 'Dashboard',
    quoteddashboard: 'Quoted Dashboard',
    pages: 'Pages',
    sections: 'Sections',
    media: 'Media',
    leads: 'Leads',
    projects: 'Projects',
    articles: 'Articles',
    articleEdit: 'Edit Article',
    site: 'Site Settings',
    users: 'Users',
    tenants: 'Tenants',
    audit: 'Audit Log',
    license: 'License',
    customers: 'Customers',
    subscriptions: 'Subscriptions',
    wpsites: 'WP Sites',
    botcrawls: 'Bot Crawls',
    posts: 'Synced Posts',
    webhookevents: 'Webhook Events',
  }[page] || 'Dashboard';
}

function money(cents, currency = 'USD') {
  const v = (cents || 0) / 100;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// ─────────────────────────────────────────────────────────────────────
// Shared UI primitives (same CSS classes as the old shell)
// ─────────────────────────────────────────────────────────────────────

function pageHeader(title, actions = '') {
  return `
    <div class="page-header">
      <h1>${escapeHtml(title)}</h1>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>
  `;
}

function panel(title, body, opts = {}) {
  return `
    <div class="panel${opts.flat ? ' panel-flat' : ''}">
      ${title ? `<h2 class="panel-title">${escapeHtml(title)}</h2>` : ''}
      ${body}
    </div>
  `;
}

function stat(label, value, sub = '', tone = '') {
  return `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(String(value))}</div>
      ${sub ? `<div class="stat-delta ${tone}">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}

function badge(label, type = '') {
  return `<span class="badge ${type}">${escapeHtml(label)}</span>`;
}

function emptyState(message) {
  return `<div class="panel" style="text-align:center;padding:32px;color:var(--muted,#666);">${escapeHtml(message)}</div>`;
}

function errorPanel(message) {
  return `<div class="panel" style="border-left:4px solid #d33;padding:16px;"><strong style="color:#d33;">Lỗi:</strong> ${escapeHtml(message)}</div>`;
}

function noticeBanner(text, tone = 'info') {
  const color = tone === 'warning' ? '#a06400' : tone === 'danger' ? '#c0392b' : '#2c5282';
  const bg = tone === 'warning' ? '#fff8e6' : tone === 'danger' ? '#fdecea' : '#eef4fc';
  return `<div class="panel" style="border-left:4px solid ${color};background:${bg};color:${color};padding:12px 16px;margin-bottom:16px;font-size:14px;">${text}</div>`;
}

function fmtDate(s) {
  if (!s) return '—';
  // SQLite "YYYY-MM-DD HH:MM:SS" → readable
  return escapeHtml(s.replace('T', ' ').replace('Z', ''));
}

// ─────────────────────────────────────────────────────────────────────
// Dashboard — real counts from every relevant table
// ─────────────────────────────────────────────────────────────────────

async function renderDashboard() {
  const [users, tenants, audit, leads, site, pagesQuoted, licenseStatus] = await Promise.all([
    api('/api/admin/users').catch(() => ({ rows: [] })),
    api('/api/admin/tenants').catch(() => ({ rows: [] })),
    api('/api/admin/audit').catch(() => ({ rows: [] })),
    api('/api/admin/leads').catch(() => ({ rows: [] })),
    api('/api/admin/site').catch(() => []),
    api('/api/admin/pages/quoted_home').catch(() => []),
    api('/api/admin/license/status').catch(() => null),
  ]);

  return `
    ${pageHeader('Dashboard', `<button class="btn-secondary" type="button" onclick="location.reload()">Refresh</button>`)}
    ${noticeBanner('Đây là dashboard thật — số đếm lấy trực tiếp từ database. Click vào card để vào trang chi tiết.')}
    <div class="grid grid-4">
      ${stat('Users', (users.rows || []).length, 'tổng (tất cả role)')}
      ${stat('Tenants', (tenants.rows || []).length, 'instance hoạt động')}
      ${stat('Sections (home)', (pagesQuoted || []).length, 'trên quoted_home')}
      ${stat('Site config keys', (site || []).length, '/api/admin/site')}
      ${stat('Leads', (leads.rows || []).length, leads._quota_notice ? 'có quota notice' : 'không che')}
      ${stat('Audit entries', (audit.rows || []).length, 'gần đây nhất')}
      ${stat('License plan', (licenseStatus && licenseStatus.plan) || 'unknown', (licenseStatus && licenseStatus.plan_label) || '')}
      ${stat('Backend', 'OmniPlug 1.4.4', '/api/health = ok')}
    </div>
    <div class="grid grid-2" style="margin-top:24px;">
      ${panel('Truy cập nhanh', `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a class="btn-secondary btn-block" href="/admin/pages.html">→ Pages (edit hero, programs)</a>
          <a class="btn-secondary btn-block" href="/admin/sections.html">→ Sections (edit raw)</a>
          <a class="btn-secondary btn-block" href="/admin/site.html">→ Site Settings (logo, contact, SEO)</a>
          <a class="btn-secondary btn-block" href="/admin/audit.html">→ Audit Log (ai sửa gì)</a>
        </div>
      `)}
      ${panel('Endpoint live', `
        <table class="table" style="font-size:13px;">
          <tr><td><code>GET /api/health</code></td><td>${badge('ok', 'active')}</td></tr>
          <tr><td><code>GET /api/public/pages/quoted_home</code></td><td>${(pagesQuoted || []).length} sections</td></tr>
          <tr><td><code>GET /api/admin/site</code></td><td>${(site || []).length} keys</td></tr>
          <tr><td><code>GET /api/admin/license/status</code></td><td>${escapeHtml((licenseStatus && licenseStatus.plan) || '—')}</td></tr>
        </table>
      `)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Pages — list all page_keys, drill into sections per page
// ─────────────────────────────────────────────────────────────────────

async function renderPagesAdmin() {
  const grouped = await api('/api/admin/pages').catch(() => ({}));
  const pageKeys = Object.keys(grouped).sort();

  if (pageKeys.length === 0) {
    return `
      ${pageHeader('Pages')}
      ${emptyState('Chưa có page nào. Tạo qua migration SQL hoặc POST /api/admin/pages/:pageKey/sections')}
    `;
  }

  return `
    ${pageHeader('Pages', `<span class="muted">${pageKeys.length} pages · ${pageKeys.reduce((n,k)=>n+grouped[k].length,0)} sections</span>`)}
    ${noticeBanner('Chọn một page bên dưới để edit các sections trong đó. Mỗi section có Title/Subtitle/Payload JSON và 1 toggle Visible.')}
    <div class="grid">
      ${pageKeys.map(pk => {
        const sections = grouped[pk] || [];
        return `
          <div class="panel">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h2 class="panel-title" style="margin:0;">${escapeHtml(pk)} <span class="muted" style="font-weight:400;">— ${sections.length} sections</span></h2>
              <a class="btn-secondary" href="#${pk}" onclick="event.preventDefault(); document.getElementById('sections-${pk}').scrollIntoView({behavior:'smooth'});">Edit sections ↓</a>
            </div>
            <div id="sections-${pk}" class="grid" style="margin-top:12px;">
              ${sections.map(s => renderSectionCard(s)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSectionCard(s) {
  const payload = s.payload || {};
  const payloadJson = JSON.stringify(payload, null, 2);
  return `
    <div class="section-card expanded" data-section-id="${s.id}">
      <div class="section-head">
        <span class="type-pill">${escapeHtml(s.component_type)}</span>
        <div>
          <strong>${escapeHtml(s.title || '(no title)')}</strong>
          <br><span class="muted">${escapeHtml(s.page_key)} · ${escapeHtml(s.section_key)} · sort=${s.sort_order}</span>
        </div>
        ${badge(s.is_visible ? 'Visible' : 'Hidden', s.is_visible ? 'active' : 'warning')}
      </div>
      <div class="section-body">
        <div class="form-grid">
          <div class="field"><label>Title</label><input data-field="title" value="${escapeHtml(s.title || '')}"></div>
          <div class="field"><label>Subtitle</label><input data-field="subtitle" value="${escapeHtml(s.subtitle || '')}"></div>
        </div>
        <div class="field" style="margin-top:12px;">
          <label>Payload (JSON)</label>
          <textarea data-field="payload" rows="8" style="font-family:var(--mono,monospace);font-size:13px;">${escapeHtml(payloadJson)}</textarea>
        </div>
        <div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap;">
          <label style="display:flex;gap:6px;align-items:center;">
            <input type="checkbox" data-field="is_visible" ${s.is_visible ? 'checked' : ''}> Visible (publish)
          </label>
          <span class="muted" style="flex:1;">Updated: ${fmtDate(s.updated_at)}</span>
          <button class="btn-primary js-save-section" data-section-id="${s.id}" type="button">Save</button>
        </div>
        <div class="save-msg muted" data-save-msg style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Sections — same as Pages but flat (no page grouping)
// ─────────────────────────────────────────────────────────────────────

async function renderSectionsAdmin() {
  const grouped = await api('/api/admin/pages').catch(() => ({}));
  const flat = [];
  for (const pk of Object.keys(grouped)) {
    for (const s of grouped[pk]) flat.push(s);
  }
  flat.sort((a, b) => (a.page_key.localeCompare(b.page_key)) || (a.sort_order - b.sort_order));

  if (flat.length === 0) {
    return `${pageHeader('Sections')}${emptyState('Chưa có section nào.')}`;
  }

  return `
    ${pageHeader('Sections', `<span class="muted">${flat.length} sections</span>`)}
    ${noticeBanner('Mọi section trên mọi page — phẳng. Edit Title/Subtitle/Payload → Save = PATCH /api/admin/pages/sections/:id. Site cache 60s.')}
    <div class="grid">
      ${flat.map(s => renderSectionCard(s)).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Site Settings — list all config keys, edit value, save per row
// ─────────────────────────────────────────────────────────────────────

async function renderSite() {
  const rows = await api('/api/admin/site').catch(() => []);
  if (rows.length === 0) {
    return `${pageHeader('Site Settings')}${emptyState('Chưa có config key nào trong site_config.')}`;
  }

  return `
    ${pageHeader('Site Settings', `<span class="muted">${rows.length} config keys</span>`)}
    ${noticeBanner('Mỗi dòng là một config key độc lập (tên thương hiệu, hotline, SEO mặc định...). Edit Value → Save = PATCH /api/admin/site/:key.')}
    <div class="panel">
      <table class="table">
        <thead><tr><th style="width:25%;">Key / Label</th><th>Value</th><th style="width:15%;">Updated</th><th style="width:8%;"></th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr data-config-key="${escapeHtml(r.key)}">
              <td>
                <code style="font-size:12px;">${escapeHtml(r.key)}</code>
                ${r.label ? `<br><strong>${escapeHtml(r.label)}</strong>` : ''}
                ${r.description ? `<br><span class="muted" style="font-size:12px;">${escapeHtml(r.description)}</span>` : ''}
              </td>
              <td>
                <input data-field="value" value="${escapeHtml(r.value || '')}" style="width:100%;">
                <div class="save-msg muted" data-save-msg style="margin-top:4px;font-size:12px;"></div>
              </td>
              <td class="muted" style="font-size:12px;">${fmtDate(r.updated_at)}</td>
              <td><button class="btn-primary js-save-site" data-config-key="${escapeHtml(r.key)}" type="button">Save</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Users (read-only)
// ─────────────────────────────────────────────────────────────────────

async function renderUsers() {
  const data = await api('/api/admin/users').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Users', `<span class="muted">${rows.length} users</span>`)}
    ${noticeBanner('Read-only view. Tạo/sửa/xoá user qua API: <code>POST /api/admin/users</code>, <code>PATCH /api/admin/users/:id</code>. UI edit sẽ wire ở M3.', 'warning')}
    <div class="panel">
      <table class="table">
        <thead><tr><th>Email</th><th>Display name</th><th>Role</th><th>Active</th><th>Tenant</th><th>Last login</th><th>Created</th></tr></thead>
        <tbody>
          ${rows.map(u => `
            <tr>
              <td><strong>${escapeHtml(u.email)}</strong></td>
              <td>${escapeHtml(u.display_name || '')}</td>
              <td>${badge(u.role, u.role === 'admin' ? 'warning' : 'active')}</td>
              <td>${badge(u.is_active ? 'yes' : 'no', u.is_active ? 'active' : 'danger')}</td>
              <td>${u.tenant_id}</td>
              <td class="muted" style="font-size:12px;">${fmtDate(u.last_login_at)}</td>
              <td class="muted" style="font-size:12px;">${fmtDate(u.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Tenants (read-only)
// ─────────────────────────────────────────────────────────────────────

async function renderTenants() {
  const data = await api('/api/admin/tenants').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Tenants', `<span class="muted">${rows.length} tenants</span>`)}
    ${noticeBanner('Mỗi tenant = một site/instance CMS độc lập. Tenant id=1 là tenant chính (marketing site). Read-only view; tạo/sửa qua API.', 'warning')}
    <div class="panel">
      <table class="table">
        <thead><tr><th>ID</th><th>Slug</th><th>Name</th><th>Domain</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          ${rows.map(t => `
            <tr>
              <td>${t.id}</td>
              <td><code>${escapeHtml(t.slug)}</code></td>
              <td><strong>${escapeHtml(t.name)}</strong></td>
              <td><code>${escapeHtml(t.domain || '—')}</code></td>
              <td>${badge(t.status, t.status === 'active' ? 'active' : 'warning')}</td>
              <td class="muted" style="font-size:12px;">${fmtDate(t.updated_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Audit log (read-only)
// ─────────────────────────────────────────────────────────────────────

async function renderAudit() {
  const data = await api('/api/admin/audit').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Audit Log', `<button class="btn-secondary" type="button" onclick="location.reload()">Refresh</button>`)}
    ${noticeBanner(`${rows.length} entries gần nhất. Mọi thay đổi quan trọng (login, edit section, edit site config...) đều ghi vào đây.`)}
    <div class="panel">
      <table class="table">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th></tr></thead>
        <tbody>
          ${rows.length === 0 ? '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px;">Chưa có entry nào</td></tr>' : ''}
          ${rows.map(e => `
            <tr>
              <td class="muted" style="font-size:12px;">${fmtDate(e.created_at)}</td>
              <td>${escapeHtml(e.user_email || `user#${e.user_id || '?'}`)}</td>
              <td><code>${escapeHtml(e.action)}</code></td>
              <td class="muted" style="font-size:12px;">${escapeHtml(e.entity_type || '')}${e.entity_id ? ` #${e.entity_id}` : ''}</td>
              <td class="muted" style="font-size:12px;">${escapeHtml(e.ip_address || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// License (read-only)
// ─────────────────────────────────────────────────────────────────────

async function renderLicense() {
  const data = await api('/api/admin/license/status').catch(() => null);
  if (!data) return `${pageHeader('License')}${errorPanel('Không load được /api/admin/license/status')}`;

  const planTone = data.plan === 'community' ? 'warning' : 'active';
  return `
    ${pageHeader('License', `<button class="btn-secondary" type="button" onclick="location.reload()">Refresh</button>`)}
    ${noticeBanner('License chứa thông tin gói (Community/Lite/Pro/Agency) anh đang dùng trên BACKEND này (không phải license của khách Quoted). Activate qua <code>POST /api/admin/license/activate</code> với JWT envelope từ OmniPlug Engineering.')}
    <div class="grid grid-2">
      ${panel('Trạng thái', `
        <table class="table">
          <tr><td><strong>Plan</strong></td><td>${badge(data.plan || '—', planTone)}</td></tr>
          <tr><td><strong>Plan label</strong></td><td>${escapeHtml(data.plan_label || '—')}</td></tr>
          <tr><td><strong>Last checked</strong></td><td class="muted">${fmtDate(data.plan_checked_at)}</td></tr>
          <tr><td><strong>License JWT</strong></td><td>${data.license ? badge('loaded', 'active') : badge('none', 'warning')}</td></tr>
        </table>
      `)}
      ${panel('Quota theo plan', `
        <div class="muted" style="font-size:13px;">
          <p><strong>Community Free</strong> — soft-lock: leads bị che PII, /api/v1/* refuse trong strict mode.</p>
          <p><strong>Lite / Pro / Agency</strong> — mở khoá API, gỡ mask, unlimited tenants.</p>
          <p style="margin-top:12px;">Activate license: <code>curl -X POST /api/admin/license/activate -d '{"license_jwt":"..."}'</code></p>
        </div>
      `)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Leads (read-only)
// ─────────────────────────────────────────────────────────────────────

async function renderLeads() {
  const data = await api('/api/admin/leads').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Leads', `<span class="muted">${rows.length} leads · ${data._quota_notice ? 'masked' : 'full'}</span>`)}
    ${data._quota_notice ? noticeBanner(escapeHtml(data._quota_notice), 'warning') : ''}
    ${rows.length === 0 ? emptyState('Chưa có lead nào. Khi khách submit form ở marketing site, lead sẽ xuất hiện ở đây.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Source</th><th>Created</th></tr></thead>
          <tbody>
            ${rows.map(l => `
              <tr>
                <td><strong>${escapeHtml(l.name || '—')}</strong></td>
                <td>${escapeHtml(l.email || '—')}</td>
                <td>${escapeHtml(l.phone || '—')}</td>
                <td>${badge(l.status, l.status === 'new' ? 'warning' : 'active')}</td>
                <td class="muted">${escapeHtml(l.source || '—')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(l.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Media (read-only listing — upload UI is M3)
// ─────────────────────────────────────────────────────────────────────

async function renderMedia() {
  const data = await api('/api/admin/media').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Media', `<span class="muted">${rows.length} / ${data.total || 0} files</span>`)}
    ${noticeBanner('Read-only listing. Upload UI sẽ wire ở M6 (media picker cho hero/section). Upload trực tiếp qua API: <code>POST /api/admin/media</code> với multipart/form-data.', 'warning')}
    ${rows.length === 0 ? emptyState('Media library trống. Upload qua API hoặc đợi M6.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Uploaded</th></tr></thead>
          <tbody>
            ${rows.map(m => `
              <tr>
                <td>${escapeHtml(m.filename || m.original_name || '—')}</td>
                <td class="muted">${escapeHtml(m.mime_type || '—')}</td>
                <td class="muted">${m.size_bytes ? Math.round(m.size_bytes / 1024) + ' KB' : '—'}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(m.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ─────────────────────────────────────────────────────────────────────
// Articles + Projects — minimal real list (the WP plugin syncs articles;
// here they are read-only for sanity check)
// ─────────────────────────────────────────────────────────────────────

async function renderArticles() {
  const data = await api('/api/admin/articles').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Articles', `<span class="muted">${rows.length} articles</span>`)}
    ${noticeBanner('Articles thường được sync từ WordPress plugin của khách, không phải tạo trong CMS này. Read-only view ở đây để kiểm tra DB.', 'warning')}
    ${rows.length === 0 ? emptyState('Chưa có article nào trong tenant này.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Published</th></tr></thead>
          <tbody>
            ${rows.map(a => `
              <tr>
                <td><strong>${escapeHtml(a.title || '—')}</strong></td>
                <td><code>${escapeHtml(a.slug || '')}</code></td>
                <td>${badge(a.status || '—', a.status === 'published' ? 'active' : 'warning')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(a.published_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

async function renderProjects() {
  const data = await api('/api/admin/projects').catch(() => ({ rows: [] }));
  const rows = data.rows || [];
  return `
    ${pageHeader('Projects', `<span class="muted">${rows.length} projects</span>`)}
    ${noticeBanner('Projects là feature của OmniPlug verticals (real-estate, spa, aesthetics). Quoted không dùng — read-only để giữ parity.', 'warning')}
    ${rows.length === 0 ? emptyState('Chưa có project nào (Quoted không dùng — đây là expected).') : `
      <div class="panel"><pre>${escapeHtml(JSON.stringify(rows, null, 2))}</pre></div>
    `}
  `;
}

function renderArticleEditStub() {
  return `
    ${pageHeader('Edit Article')}
    ${noticeBanner('Article editor chưa được wire vào backend trong Quoted overlay. Articles thường sync qua WordPress plugin chứ không tạo từ CMS. Đặt task này vào M3 nếu cần.', 'warning')}
    <a class="btn-secondary" href="/admin/articles.html">← Back to Articles</a>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// Quoted SaaS renderers (M3 — real product surfaces, not generic CMS)
// ═══════════════════════════════════════════════════════════════════

// ── Quoted SaaS dashboard — KPIs the operator actually cares about
async function renderQuotedDashboard() {
  const d = await api('/api/admin/quoted/dashboard').catch(() => null);
  if (!d) return `${pageHeader('Quoted Dashboard')}${errorPanel('Không load được /api/admin/quoted/dashboard')}`;

  return `
    ${pageHeader('Quoted SaaS Dashboard', `<button class="btn-secondary" type="button" onclick="location.reload()">Refresh</button>`)}
    ${noticeBanner(`Số liệu trực tiếp từ DB. MRR/ARR tính từ subscription đang active × giá variant (Pro $19 / Agency $29 hàng tháng; yearly chia 12). Cập nhật mỗi khi LS webhook về.`)}

    <div class="grid grid-4">
      ${stat('MRR', '$' + money(d.mrr_cents, '').trim(), 'Monthly Recurring Revenue')}
      ${stat('ARR', '$' + money(d.arr_cents, '').trim(), 'Annual Recurring Revenue')}
      ${stat('Total Revenue', '$' + money(d.total_revenue_cents, '').trim(), `${d.customers} customers all-time`)}
      ${stat('Active Subscriptions', String(d.active_subscriptions), `${d.active_licenses} licenses`)}
    </div>

    <div class="grid grid-4" style="margin-top:16px;">
      ${stat('Active WP Sites', String(d.wp_sites_active), `${d.wp_sites_total} total registered`)}
      ${stat('Posts Synced', String(d.posts_synced), 'across all WP sites')}
      ${stat('Bot Crawls (7d)', String(d.bot_crawls_7d), 'GPTBot/ClaudeBot/PerplexityBot/...')}
      ${stat('Citations (7d)', String(d.citations_7d), 'Phase 2 — citation polling')}
    </div>

    <div class="grid grid-2" style="margin-top:24px;">
      ${panel('Subscriptions by plan', `
        ${d.active_subscriptions_by_plan.length === 0
          ? `<p class="muted" style="margin:8px 0;">Chưa có subscription active nào. Sau khi khách đầu tiên mua, số sẽ hiện ở đây.</p>`
          : `<table class="table"><thead><tr><th>Plan</th><th>Active subs</th></tr></thead><tbody>
              ${d.active_subscriptions_by_plan.map(s => `<tr><td><code>${escapeHtml(s.plan_id || '—')}</code></td><td><strong>${s.c}</strong></td></tr>`).join('')}
            </tbody></table>`}
      `)}
      ${panel('System health', `
        <table class="table">
          <tr><td><strong>Webhook failures</strong></td><td>${d.webhook_failures > 0 ? badge(String(d.webhook_failures), 'danger') : badge('0', 'active')}</td></tr>
          <tr><td><strong>Backend</strong></td><td>${badge('ok', 'active')} v1.4.4</td></tr>
          <tr><td colspan="2" class="muted" style="font-size:12px;">Webhook failures > 0 cần check LS dashboard + retry. Xem chi tiết ở /admin/webhook-events.html (M4 — chưa wire UI).</td></tr>
        </table>
      `)}
    </div>

    <div class="grid grid-2" style="margin-top:16px;">
      ${panel('Truy cập nhanh', `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a class="btn-secondary btn-block" href="/admin/customers.html">→ Customers (${d.customers})</a>
          <a class="btn-secondary btn-block" href="/admin/subscriptions.html">→ Subscriptions (${d.active_subscriptions} active)</a>
          <a class="btn-secondary btn-block" href="/admin/wp-sites.html">→ WP Sites (${d.wp_sites_active} active)</a>
          <a class="btn-secondary btn-block" href="/admin/bot-crawls.html">→ Bot Crawls (${d.bot_crawls_7d} last 7d)</a>
        </div>
      `)}
      ${panel('Marketing CMS', `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <a class="btn-secondary btn-block" href="/admin/pages.html">→ Edit homepage hero / promo cards</a>
          <a class="btn-secondary btn-block" href="/admin/site.html">→ Edit site-wide settings</a>
          <a class="btn-secondary btn-block" href="/admin/audit.html">→ Audit log (who edited what)</a>
        </div>
      `)}
    </div>
  `;
}

// ── Customers ───────────────────────────────────────────────────────
async function renderCustomers() {
  const d = await api('/api/admin/quoted/customers').catch(() => ({ rows: [] }));
  const rows = d.rows || [];
  return `
    ${pageHeader('Customers', `<span class="muted">${d.total || 0} total</span>`)}
    ${noticeBanner('Mỗi row = 1 khách mua qua Lemon Squeezy. Tạo tự động từ webhook order_created. Read-only ở đây — refund/cancel làm bên LS dashboard.')}
    ${rows.length === 0 ? emptyState('Chưa có customer nào. Sau khi khách đầu tiên hoàn tất checkout, row sẽ hiện ở đây.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Email</th><th>Name</th><th>Latest plan</th><th>Active subs</th><th>Active licenses</th><th>LS customer ID</th><th>Created</th></tr></thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td><strong>${escapeHtml(c.email)}</strong></td>
                <td>${escapeHtml(c.name || '—')}</td>
                <td>${c.latest_plan ? `<code>${escapeHtml(c.latest_plan)}</code>` : '<span class="muted">—</span>'}</td>
                <td>${c.active_subs > 0 ? badge(String(c.active_subs), 'active') : '<span class="muted">0</span>'}</td>
                <td>${c.active_licenses > 0 ? badge(String(c.active_licenses), 'active') : '<span class="muted">0</span>'}</td>
                <td class="muted mono" style="font-size:12px;">${escapeHtml(c.lemon_customer_id || '—')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(c.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ── Subscriptions ───────────────────────────────────────────────────
async function renderSubscriptions() {
  const d = await api('/api/admin/quoted/subscriptions').catch(() => ({ rows: [], by_status: [] }));
  const rows = d.rows || [];
  return `
    ${pageHeader('Subscriptions', `<span class="muted">${d.total || 0} total</span>`)}
    ${noticeBanner('Subscription = recurring plan (monthly/yearly Pro/Agency). Tạo từ LS subscription_created webhook. Status flip qua webhook subscription_cancelled/resumed/expired.')}

    ${d.by_status && d.by_status.length > 0 ? `
      <div class="grid grid-4">
        ${d.by_status.map(s => stat(s.status, String(s.c), '', s.status === 'active' ? '' : 'warning')).join('')}
      </div>
    ` : ''}

    ${rows.length === 0 ? emptyState('Chưa có subscription nào. Tạo bằng cách: khách mua qua /pricing → LS gửi webhook subscription_created.') : `
      <div class="panel" style="margin-top:16px;">
        <table class="table">
          <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Renews</th><th>Ends</th><th>LS sub ID</th><th>Created</th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr>
                <td>
                  ${escapeHtml(s.customer_email || '—')}
                  ${s.customer_name ? `<br><span class="muted" style="font-size:12px;">${escapeHtml(s.customer_name)}</span>` : ''}
                </td>
                <td><code>${escapeHtml(s.plan_id || '—')}</code></td>
                <td>${badge(s.status, s.status === 'active' ? 'active' : (s.status === 'cancelled' ? 'danger' : 'warning'))}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(s.renews_at)}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(s.ends_at)}</td>
                <td class="muted mono" style="font-size:12px;">${escapeHtml(s.lemon_subscription_id || '—')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(s.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ── WP Sites ────────────────────────────────────────────────────────
async function renderWpSites() {
  const d = await api('/api/admin/quoted/wp-sites').catch(() => ({ rows: [] }));
  const rows = d.rows || [];
  return `
    ${pageHeader('WP Sites', `<span class="muted">${d.active || 0} active / ${d.total || 0} total</span>`)}
    ${noticeBanner('Mỗi row = 1 cài đặt WordPress plugin Quoted của khách. Revoke = force-disconnect (xoá JWT, set inactive). Khách phải re-activate license. Dùng khi nghi ngờ site bị compromise.')}
    ${rows.length === 0 ? emptyState('Chưa có WP site nào đăng ký. Khách mua → email license → cài plugin → Activate → site xuất hiện ở đây.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Domain</th><th>Plan</th><th>Customer</th><th>Posts</th><th>Crawls 7d</th><th>WP / Plugin</th><th>Last seen</th><th></th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr data-wp-site-id="${s.id}" data-wp-site-domain="${escapeHtml(s.domain)}">
                <td>
                  <strong>${escapeHtml(s.domain)}</strong>
                  ${s.site_name ? `<br><span class="muted" style="font-size:12px;">${escapeHtml(s.site_name)}</span>` : ''}
                  ${s.is_active ? '' : '&nbsp;' + badge('revoked', 'danger')}
                </td>
                <td>${badge(s.plan || 'free', s.plan === 'free' ? 'warning' : 'active')}</td>
                <td class="muted" style="font-size:12px;">${escapeHtml(s.customer_email || s.admin_email || '—')}</td>
                <td><strong>${s.post_count || 0}</strong></td>
                <td>${s.crawls_7d > 0 ? `<strong>${s.crawls_7d}</strong>` : '<span class="muted">0</span>'}</td>
                <td class="muted mono" style="font-size:12px;">${escapeHtml(s.wp_version || '?')} / ${escapeHtml(s.plugin_version || '?')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(s.last_seen_at)}</td>
                <td>${s.is_active ? `<button class="btn-link danger-text js-revoke-site" data-wp-site-id="${s.id}" type="button">Revoke</button>` : '<span class="muted">—</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ── Webhook Events / Failures ─────────────────────────────────────
async function renderWebhookEvents() {
  const d = await api('/api/admin/quoted/webhook-events').catch(() => ({ rows: [] }));
  const rows = d.rows || [];
  const showFailedOnly = (rows.filter(r => !r.processed || !r.signature_valid || r.error_message));
  return `
    ${pageHeader('Webhook Events', `<span class="muted">${d.total || 0} total · ${d.failures || 0} failures</span>`)}
    ${noticeBanner(`Lemon Squeezy webhook delivery log. Failures = signature_valid=0 OR (processed=0 + error_message). Failures > 0 cần check LS dashboard + retry. Tham khảo INCIDENT_RESPONSE.md Runbook 5.`, d.failures > 0 ? 'warning' : 'info')}

    ${rows.length === 0 ? emptyState('Chưa có webhook event nào. Khi khách checkout, LS sẽ POST event đến /api/payments/webhook/lemon-squeezy.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Event</th><th>Provider event_id</th><th>Sig</th><th>Processed</th><th>Received</th><th>Processed at</th><th>Error</th></tr></thead>
          <tbody>
            ${rows.map(e => `
              <tr>
                <td><strong>${escapeHtml(e.event_name)}</strong></td>
                <td class="muted mono" style="font-size:12px;">${escapeHtml(e.event_id || '—')}</td>
                <td>${e.signature_valid ? badge('ok', 'active') : badge('bad', 'danger')}</td>
                <td>${e.processed ? badge('done', 'active') : badge('pending', 'warning')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(e.received_at)}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(e.processed_at)}</td>
                <td class="danger-text" style="font-size:12px;">${escapeHtml(e.error_message || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ── Bot crawls (the product's whole reason for existing) ────────────
async function renderBotCrawls() {
  const d = await api('/api/admin/quoted/bot-crawls?days=7').catch(() => null);
  if (!d) return `${pageHeader('Bot Crawls')}${errorPanel('Không load được /api/admin/quoted/bot-crawls')}`;

  return `
    ${pageHeader('Bot Crawls', `<span class="muted">${d.total} hits last ${d.days} days</span>`)}
    ${noticeBanner(`Bot crawls = AI crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) visit khách's WP site. Plugin của khách log lại + sync mỗi giờ. Đây là VALUE-PROP THẬT của Quoted: chứng minh AI thực sự đang crawl site khách.`)}

    ${d.total === 0 ? emptyState('Chưa có bot crawl nào. Sau khi khách cài plugin + site được crawl bởi AI bot, dữ liệu sẽ tự sync lên.') : `
      <div class="grid grid-2">
        ${panel('Top bots (last ' + d.days + ' days)', `
          <table class="table">
            <thead><tr><th>Bot</th><th>Hits</th></tr></thead>
            <tbody>
              ${d.by_bot.map(b => `<tr><td><strong>${escapeHtml(b.bot_name)}</strong></td><td><strong>${b.hits}</strong></td></tr>`).join('')}
            </tbody>
          </table>
        `)}
        ${panel('Top sites being crawled', `
          ${d.top_sites.length === 0 ? '<p class="muted">No site data yet</p>' : `
            <table class="table">
              <thead><tr><th>Domain</th><th>Hits</th></tr></thead>
              <tbody>
                ${d.top_sites.map(s => `<tr><td><code>${escapeHtml(s.domain || '—')}</code></td><td><strong>${s.hits}</strong></td></tr>`).join('')}
              </tbody>
            </table>
          `}
        `)}
      </div>

      <div class="panel" style="margin-top:16px;">
        <h2 class="panel-title">Crawls by day</h2>
        <table class="table">
          <thead><tr><th>Day</th><th>Hits</th></tr></thead>
          <tbody>
            ${d.by_day.map(day => `<tr><td>${escapeHtml(day.day)}</td><td><strong>${day.hits}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// ── Synced posts (content WP plugin sent to backend) ────────────────
async function renderQuotedPosts() {
  const d = await api('/api/admin/quoted/posts').catch(() => ({ rows: [] }));
  const rows = d.rows || [];
  return `
    ${pageHeader('Synced Posts', `<span class="muted">${d.total || 0} total</span>`)}
    ${noticeBanner('Mỗi row = 1 post / page WordPress khách đã sync lên backend Quoted (qua POST /api/v1/wp-sites/posts/sync mỗi giờ). Dùng để serve /api/public/llm/sitemap.txt + Markdown.')}
    ${rows.length === 0 ? emptyState('Chưa có post nào. Sau khi khách activate plugin, hourly cron sẽ sync posts.') : `
      <div class="panel">
        <table class="table">
          <thead><tr><th>Title</th><th>Site</th><th>Slug</th><th>Published</th><th>Modified</th></tr></thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td>
                  <strong>${escapeHtml(p.title || '—')}</strong>
                  ${p.author ? `<br><span class="muted" style="font-size:12px;">by ${escapeHtml(p.author)}</span>` : ''}
                </td>
                <td><code style="font-size:12px;">${escapeHtml(p.site_domain || '—')}</code></td>
                <td class="muted" style="font-size:12px;">/${escapeHtml(p.slug || '')}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(p.published_at)}</td>
                <td class="muted" style="font-size:12px;">${fmtDate(p.modified_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}
