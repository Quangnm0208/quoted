const TOKEN_KEY = 'omniplug_cms_token';
const THEME_KEY = 'omniplug_theme';

export const icon = {
  logo: svg('layers', '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'),
  dashboard: svg('layout-dashboard', '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  articles: svg('file-text', '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
  sections: svg('book-open', '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z"/>'),
  media: svg('image', '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  leads: svg('users-round', '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3-1.6-5.6-4-7"/><path d="M18 3.5a5 5 0 0 1 0 9"/>'),
  projects: svg('star', '<path d="M11.5 2.3a.5.5 0 0 1 .9 0l2.7 5.5 6 .9a.5.5 0 0 1 .3.8l-4.4 4.2 1 6a.5.5 0 0 1-.7.5L12 17.4l-5.4 2.8a.5.5 0 0 1-.7-.5l1-6-4.3-4.2a.5.5 0 0 1 .3-.8l6-.9Z"/>'),
  site: svg('settings', '<path d="M12.2 2h-.4a2 2 0 0 0-2 1.8l-.1 1a7.5 7.5 0 0 0-1.4.8l-.9-.4a2 2 0 0 0-2.5.8l-.2.4a2 2 0 0 0 .3 2.6l.8.6a7.5 7.5 0 0 0 0 1.6l-.8.6a2 2 0 0 0-.3 2.6l.2.4a2 2 0 0 0 2.5.8l.9-.4a7.5 7.5 0 0 0 1.4.8l.1 1a2 2 0 0 0 2 1.8h.4a2 2 0 0 0 2-1.8l.1-1a7.5 7.5 0 0 0 1.4-.8l.9.4a2 2 0 0 0 2.5-.8l.2-.4a2 2 0 0 0-.3-2.6l-.8-.6a7.5 7.5 0 0 0 0-1.6l.8-.6a2 2 0 0 0 .3-2.6l-.2-.4a2 2 0 0 0-2.5-.8l-.9.4a7.5 7.5 0 0 0-1.4-.8l-.1-1a2 2 0 0 0-2-1.8Z"/><circle cx="12" cy="12" r="3"/>'),
  users: svg('user-round', '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
  tenants: svg('briefcase-business', '<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18 18 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>'),
  audit: svg('shield', '<path d="M20 13c0 5-3.5 7.5-7.7 8.8a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .7-1l7-2.7a1 1 0 0 1 .6 0l7 2.7a1 1 0 0 1 .7 1Z"/>'),
  license: svg('key-round', '<path d="M2 18v3h3l9.6-9.6"/><circle cx="16.5" cy="7.5" r="5.5"/>'),
  search: svg('search', '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  moon: svg('moon', '<path d="M12 3a6 6 0 1 0 9 7.4A7 7 0 1 1 12 3Z"/>'),
  sun: svg('sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>'),
  monitor: svg('monitor', '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
  logout: svg('log-out', '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  upload: svg('upload', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  edit: svg('square-pen', '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>'),
  chevron: svg('chevron-down', '<path d="m6 9 6 6 6-6"/>'),
  plus: svg('plus', '<path d="M5 12h14"/><path d="M12 5v14"/>'),
  eye: svg('eye', '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
};

function svg(label, body) {
  return `<svg aria-hidden="true" data-icon="${label}" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
}

export function setTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-btn]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeBtn === theme);
  });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function api(path, opts = {}) {
  const headers = {};
  let body;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (!opts.skipAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { method: opts.method || 'GET', headers, body });
  let payload = null;
  try { payload = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(payload?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

export async function guard() {
  if (!getToken()) {
    location.href = '/admin/login.html';
    return null;
  }
  try {
    const payload = await api('/api/auth/me');
    return payload.user || payload;
  } catch {
    clearToken();
    location.href = '/admin/login.html';
    return null;
  }
}

export function toast(message, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  stack.appendChild(node);
  setTimeout(() => node.classList.add('out'), 2600);
  setTimeout(() => node.remove(), 2900);
}

export async function renderShell(activeTab, pageTitle) {
  const user = await guard();
  if (!user) return null;
  const shell = document.getElementById('headerMount');
  const email = user.email || 'admin@vinhomes.vn';
  const initial = email[0]?.toUpperCase() || 'A';
  const roleLabel = user.role === 'admin' ? 'Pro' : user.role;
  const navGroups = [
    { label: '', items: [{ id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', icon: icon.dashboard }] },
    { label: 'Content', items: [
      { id: 'articles', label: 'Bài viết', href: '/admin/articles.html', icon: icon.articles },
      { id: 'pages', label: 'Pages', href: '/admin/pages.html', icon: icon.sections },
      { id: 'sections', label: 'Sections', href: '/admin/sections.html', icon: icon.sections },
      { id: 'media', label: 'Media', href: '/admin/media.html', icon: icon.media },
    ] },
    { label: 'Campaigns', items: [
      { id: 'leads', label: 'Leads', href: '/admin/leads.html', icon: icon.leads, badge: '4' },
      { id: 'projects', label: 'Tiến độ', href: '/admin/projects.html', icon: icon.projects },
    ] },
    { label: 'System', items: [
      { id: 'site', label: 'Site Settings', href: '/admin/site.html', icon: icon.site },
      { id: 'users', label: 'Users', href: '/admin/users.html', icon: icon.users },
      { id: 'tenants', label: 'Tenants', href: '/admin/tenants.html', icon: icon.tenants },
      { id: 'audit', label: 'Audit Log', href: '/admin/audit.html', icon: icon.audit },
      { id: 'license', label: 'License', href: '/admin/license.html', icon: icon.license },
    ] },
  ];
  shell.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">${icon.logo}</div>
        <div>
          <div class="brand-name">OmniPlug CMS</div>
          <div class="brand-sub">vinhomes.vn</div>
        </div>
      </div>
      <div class="theme-area">
        <div class="side-label">Giao diện</div>
        ${themeSwitcher()}
      </div>
      <nav class="nav">
        ${navGroups.map((group) => `
          <div class="nav-group">
            ${group.label ? `<span class="side-label nav-label">${group.label}</span>` : ''}
            ${group.items.map((item) => `
              <a class="nav-item${item.id === activeTab ? ' active' : ''}" href="${item.href}">
                ${item.icon}
                <span>${item.label}</span>
                ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
              </a>
            `).join('')}
          </div>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="avatar">${escapeHtml(initial)}</div>
        <div class="user-meta">
          <div class="user-email">${escapeHtml(email)}</div>
          <span class="badge amber">${escapeHtml(roleLabel)}</span>
        </div>
        <button class="icon-btn btn-icon" id="logoutBtn" type="button" title="Đăng xuất">${icon.logout}</button>
      </div>
    </aside>
    <header class="topbar">
      <div class="breadcrumb">${escapeHtml(pageTitle)}</div>
      <button class="search-trigger" type="button" data-open-palette>
        ${icon.search}
        <span>Tìm kiếm...</span>
        <kbd>⌘K</kbd>
      </button>
    </header>
  `;
  setTheme(getTheme());
  return user;
}

export function themeSwitcher() {
  const current = getTheme();
  return `
    <div class="theme-switcher">
      <button class="theme-btn${current === 'dark' ? ' active' : ''}" type="button" data-theme-btn="dark">${icon.moon}<span>Dark</span></button>
      <button class="theme-btn${current === 'light' ? ' active' : ''}" type="button" data-theme-btn="light">${icon.sun}<span>Light</span></button>
      <button class="theme-btn${current === 'auto' ? ' active' : ''}" type="button" data-theme-btn="auto">${icon.monitor}<span>Auto</span></button>
    </div>
  `;
}
