import { clearToken, icon, setTheme, toast } from './shell.js';

const commandItems = [
  ['Dashboard', 'Trang', '/admin/dashboard.html', icon.dashboard],
  ['Bài viết', 'Trang', '/admin/articles.html', icon.articles],
  ['Bài viết mới', 'Action', '/admin/article-edit.html', icon.plus],
  ['Sections', 'Trang', '/admin/sections.html', icon.sections],
  ['Media Library', 'Trang', '/admin/media.html', icon.media],
  ['Leads', 'Trang', '/admin/leads.html', icon.leads],
  ['Tiến độ dự án', 'Trang', '/admin/projects.html', icon.projects],
  ['Site Settings', 'Trang', '/admin/site.html', icon.site],
  ['Users', 'Trang', '/admin/users.html', icon.users],
  ['Tenants', 'Trang', '/admin/tenants.html', icon.tenants],
  ['Audit Log', 'Trang', '/admin/audit.html', icon.audit],
  ['License', 'Trang', '/admin/license.html', icon.license],
  ['Đổi giao diện sáng', 'Action', 'theme:light', icon.sun],
  ['Đổi giao diện tối', 'Action', 'theme:dark', icon.moon],
  ['Đăng xuất', 'Action', 'logout', icon.logout],
];

let selectedCommand = 0;

export function bindInteractions() {
  document.querySelectorAll('[data-theme-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.themeBtn);
      toast('Đã đổi giao diện', 'success');
    });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearToken();
    location.href = '/admin/login.html';
  });

  document.querySelectorAll('[data-open-palette]').forEach((btn) => {
    btn.addEventListener('click', openPalette);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
    }
  });

  bindSaveButtons();
  bindExportButtons();
  bindDeleteRows();
  bindFilterChips();
  bindPagination();
  bindToggles();
  bindMediaTiles();
  bindSectionAccordion();
  bindLicenseButtons();
}

function bindSaveButtons() {
  document.querySelectorAll('.js-save').forEach((btn) => {
    btn.addEventListener('click', () => {
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Đang lưu...';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = original;
        toast('Đã lưu thay đổi', 'success');
      }, 600);
    });
  });
}

function bindExportButtons() {
  document.querySelectorAll('.js-export').forEach((btn) => {
    btn.addEventListener('click', () => toast('Đã chuẩn bị file...', 'success'));
  });
}

function bindDeleteRows() {
  document.querySelectorAll('.js-delete-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      if (!row) {
        const selected = document.querySelectorAll('.media-tile.selected');
        selected.forEach((tile) => tile.remove());
        if (selected.length) toast('Đã xóa ảnh đã chọn', 'success');
        return;
      }
      row.style.transition = 'opacity 180ms ease, transform 180ms ease';
      row.style.opacity = '0';
      row.style.transform = 'translateX(16px)';
      setTimeout(() => row.remove(), 200);
      toast('Đã xóa dòng đã chọn', 'success');
    });
  });
}

function bindFilterChips() {
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.classList.add('flash');
      setTimeout(() => chip.classList.remove('flash'), 350);
    });
  });
}

function bindPagination() {
  document.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.parentElement?.querySelectorAll('.page-btn').forEach((sibling) => sibling.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function bindToggles() {
  document.querySelectorAll('.toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => toggle.classList.toggle('on'));
  });
}

function bindMediaTiles() {
  document.querySelectorAll('.media-tile').forEach((tile) => {
    tile.addEventListener('click', () => tile.classList.toggle('selected'));
  });
}

function bindSectionAccordion() {
  document.querySelectorAll('.section-head').forEach((head) => {
    head.addEventListener('click', () => {
      const card = head.closest('.section-card');
      if (!card) return;
      card.parentElement?.querySelectorAll('.section-card.expanded').forEach((open) => {
        if (open !== card) open.classList.remove('expanded');
      });
      card.classList.toggle('expanded');
    });
  });
}

function bindLicenseButtons() {
  document.querySelectorAll('.js-license-activate').forEach((btn) => {
    btn.addEventListener('click', () => toast('License đã được verify', 'success'));
  });
  document.querySelectorAll('.js-crl-sync').forEach((btn) => {
    btn.addEventListener('click', () => toast('CRL đồng bộ thành công · 0 revocations', 'success'));
  });
}

function openPalette() {
  let backdrop = document.querySelector('.palette-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'palette-backdrop';
    backdrop.innerHTML = `
      <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input type="text" id="paletteInput" placeholder="Tìm trang hoặc hành động...">
        <div class="palette-list" id="paletteList"></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closePalette();
    });
    backdrop.querySelector('#paletteInput').addEventListener('input', renderPaletteItems);
    backdrop.querySelector('#paletteInput').addEventListener('keydown', handlePaletteKeys);
  }
  selectedCommand = 0;
  backdrop.classList.add('open');
  renderPaletteItems();
  setTimeout(() => backdrop.querySelector('#paletteInput')?.focus(), 0);
}

function closePalette() {
  document.querySelector('.palette-backdrop')?.classList.remove('open');
}

function renderPaletteItems() {
  const input = document.querySelector('#paletteInput');
  const list = document.querySelector('#paletteList');
  if (!input || !list) return;
  const query = input.value.trim().toLowerCase();
  const items = commandItems.filter(([label, kind]) => {
    return !query || `${label} ${kind}`.toLowerCase().includes(query);
  });
  if (selectedCommand >= items.length) selectedCommand = 0;
  list.innerHTML = items.map(([label, kind, target, itemIcon], index) => `
    <div class="palette-item${index === selectedCommand ? ' active' : ''}" data-command="${target}">
      <div class="palette-icon">${itemIcon}</div>
      <div>${label}</div>
      <div class="kind-tag">${kind}</div>
    </div>
  `).join('');
  list.querySelectorAll('.palette-item').forEach((item, index) => {
    item.addEventListener('mouseenter', () => {
      selectedCommand = index;
      renderPaletteItems();
    });
    item.addEventListener('click', () => executeCommand(item.dataset.command));
  });
}

function handlePaletteKeys(event) {
  const list = document.querySelectorAll('.palette-item');
  if (event.key === 'Escape') {
    closePalette();
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedCommand = Math.min(selectedCommand + 1, Math.max(list.length - 1, 0));
    renderPaletteItems();
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedCommand = Math.max(selectedCommand - 1, 0);
    renderPaletteItems();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const item = document.querySelectorAll('.palette-item')[selectedCommand];
    if (item) executeCommand(item.dataset.command);
  }
}

function executeCommand(target) {
  if (target === 'logout') {
    clearToken();
    location.href = '/admin/login.html';
    return;
  }
  if (target?.startsWith('theme:')) {
    setTheme(target.split(':')[1]);
    toast('Đã đổi giao diện', 'success');
    closePalette();
    return;
  }
  if (target) location.href = target;
}
