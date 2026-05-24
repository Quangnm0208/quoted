import { icon } from './shell.js';

const articleRows = [
  ['Vinhomes Ocean Park 3 - Cập nhật tiến độ tháng 5/2026', '/vinhomes-ocean-park-3-tien-do-thang-5-2026', 'Đã đăng', 'published', 'linh@vinhomes.vn', '22/05/2026 08:45'],
  ['Smart City - Mở bán phân khu The Miami', '/smart-city-mo-ban-the-miami', 'Đã đăng', 'published', 'linh@vinhomes.vn', '20/05/2026 17:12'],
  ['Hướng dẫn vay mua nhà 2026 cho người trẻ', '/huong-dan-vay-mua-nha-2026', 'Nháp', 'draft', 'thu@vinhomes.vn', '19/05/2026 22:08'],
  ['5 lý do chọn căn hộ ven sông tại Ocean Park', '/5-ly-do-can-ho-ven-song-ocean-park', 'Đã đăng', 'published', 'quang@vinhomes.vn', '18/05/2026 14:30'],
  ['Royal City - Lễ tri ân cư dân lần thứ 8', '/royal-city-le-tri-an-cu-dan-2026', 'Đã đăng', 'published', 'linh@vinhomes.vn', '15/05/2026 11:00'],
  ['Chính sách thanh toán linh hoạt Q3/2026', '/chinh-sach-thanh-toan-q3-2026', 'Nháp', 'draft', 'quang@vinhomes.vn', '14/05/2026 16:22'],
  ['Tiện ích nội khu - Bể bơi 4 mùa Aqua Bay', '/tien-ich-be-boi-4-mua-aqua-bay', 'Lưu trữ', 'archived', 'thu@vinhomes.vn', '09/05/2026 10:14'],
  ['Cẩm nang setup văn phòng tại nhà', '/cam-nang-setup-van-phong-tai-nha', 'Đã đăng', 'published', 'linh@vinhomes.vn', '05/05/2026 09:00'],
];

const leads = [
  ['Phạm Thị Hà', '28 tuổi · Hà Nội', '0987 654 321', 'ha.pham@gmail.com', 'Ocean Park 3 - S2', 'Facebook Ads', 'Mới', 'new', '22/05/2026 09:42', '-', 'Gọi'],
  ['Trần Quốc Hùng', '35 tuổi · Hải Phòng', '0912 345 678', 'hung.tran@outlook.com', 'Smart City - Miami', 'Google Ads', 'Mới', 'new', '22/05/2026 08:15', '-', 'Gọi'],
  ['Lê Mai Anh', '42 tuổi · Hà Nội', '0903 111 222', 'maianh.le@vinhomes.vn', 'Royal City - R5', 'Web form', 'Mới', 'new', '21/05/2026 22:33', 'thu@', 'Gọi'],
  ['Nguyễn Văn An', '31 tuổi · TP.HCM', '0978 555 333', 'an.nguyen@example.com', 'Grand Park - S10', 'Tiktok Ads', 'Đã liên hệ', 'contacted', '21/05/2026 14:10', 'linh@', 'Ghi chú'],
  ['Đặng Thị Lan', '39 tuổi · Hà Nội', '0888 999 111', 'lan.dang@gmail.com', 'Times City - T6', 'Referral', 'Có tiềm chi', 'qualified', '20/05/2026 11:00', 'thu@', 'Ghi chú'],
  ['Vũ Hoàng Long', '29 tuổi · Hà Nội', '0901 234 567', 'long.vu@vinhomes.vn', 'Ocean Park 3 - S1', 'Web form', 'Chốt deal', 'converted', '19/05/2026 16:45', 'linh@', 'Xem'],
  ['Bùi Thanh Tâm', '45 tuổi · Đà Nẵng', '0945 678 123', 'tam.bui@outlook.com', 'Smart City - Hawaii', 'Hotline', 'Đã liên hệ', 'contacted', '19/05/2026 10:22', 'quang@', 'Ghi chú'],
  ['Hoàng Minh Đức', '52 tuổi · Hà Nội', '0911 234 999', 'duc.hoang@example.com', 'Royal City - R3', 'Email Campaign', 'Không quan tâm', 'lost', '18/05/2026 09:00', 'thu@', 'Mở lại'],
];

const mediaFiles = [
  'ocean-park-3-cover.webp', 'aqua-bay-render.webp', 'cat-noc-s201-2026-05-18.webp', 'smart-city-miami.webp',
  'park-overview.webp', 'pool-aqua-bay-hero.webp', 'vinh-vincom-plaza.webp', 'royal-city-night.webp',
  'tower-render-front.webp', 'marina-walk.webp', 'sunrise-beach.webp', 'sport-center-render.webp',
];

export function renderPage(page) {
  const renderers = {
    dashboard: renderDashboard,
    articles: renderArticles,
    articleEdit: renderArticleEdit,
    sections: renderSections,
    media: renderMedia,
    leads: renderLeads,
    projects: renderProjects,
    site: renderSite,
    users: renderUsers,
    tenants: renderTenants,
    audit: renderAudit,
    license: renderLicense,
  };
  return (renderers[page] || renderDashboard)();
}

export function pageTitle(page) {
  return {
    dashboard: 'Dashboard',
    articles: 'Bài viết',
    articleEdit: 'Bài viết / Vinhomes Ocean Park 3',
    sections: 'Sections',
    media: 'Media',
    leads: 'Leads',
    projects: 'Tiến độ',
    site: 'Site Settings',
    users: 'Users',
    tenants: 'Tenants',
    audit: 'Audit Log',
    license: 'License',
  }[page] || 'Dashboard';
}

function stat(label, value, delta, tone = 'up') {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-delta ${tone}">${delta}</div>
    </div>
  `;
}

function badge(label, type) {
  return `<span class="badge ${type}">${label}</span>`;
}

function pageHeader(title, actions = '') {
  return `
    <div class="page-header">
      <h1>${title}</h1>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>
  `;
}

function filterBar(search, chips, right = '') {
  return `
    <div class="filter-bar">
      <div class="filter-search">${icon.search}<input type="text" placeholder="${search}"></div>
      ${chips.map((chip) => `<button class="filter-chip" type="button">${chip} ${icon.chevron}</button>`).join('')}
      <div class="right">${right}</div>
    </div>
  `;
}

function pagination(text, last = '16') {
  return `
    <div class="pagination">
      <span class="muted">${text}</span>
      <div class="page-list">
        <button class="page-btn" type="button">‹</button>
        <button class="page-btn active" type="button" data-page="1">1</button>
        <button class="page-btn" type="button" data-page="2">2</button>
        <button class="page-btn" type="button" data-page="3">3</button>
        <span class="muted">...</span>
        <button class="page-btn" type="button" data-page="${last}">${last}</button>
        <button class="page-btn" type="button">›</button>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const activities = [
    ['linh@', 'Đăng bài <strong>Vinhomes Ocean Park 3 - tiến độ tháng 5</strong>', '5 phút trước'],
    ['quang@', 'Cập nhật milestone <strong>Cất nóc Block S2.01</strong>', '42 phút trước'],
    ['thu@', 'Chuyển lead <strong>Nguyễn Văn A</strong> → ' + badge('Chốt deal', 'converted'), '2 giờ trước'],
    ['linh@', 'Tải lên 14 ảnh vào Media', 'hôm qua, 16:20'],
    ['admin@', 'Sửa Site Settings · hotline', 'hôm qua, 09:11'],
  ];
  return `
    ${pageHeader('Chào mừng trở lại, Quân', `
      <a class="btn-secondary" href="/api/public/site" target="_blank" rel="noreferrer">Xem site ↗</a>
      <a class="btn-primary" href="/admin/article-edit.html">${icon.plus} Bài mới</a>
    `)}
    <div class="grid grid-4">
      ${stat('Bài viết public', '128', '▲ 12 trong 30 ngày')}
      ${stat('Dự án', '14', '— không đổi', '')}
      ${stat('Leads tổng', '1,247', '▲ 84 tuần này')}
      ${stat('Lead mới', '4', 'cần liên hệ', 'warning')}
    </div>
    <div class="grid layout-rail" style="margin-top:16px;">
      <div class="panel panel-table">
        <div style="padding:18px 20px;"><h2 class="panel-title" style="margin:0;">Hoạt động gần đây</h2></div>
        <table class="table">
          <thead><tr><th>Người</th><th>Hành động</th><th>Thời gian</th></tr></thead>
          <tbody>
            ${activities.map((row) => `<tr><td>${row[0]}</td><td class="activity-action">${row[1]}</td><td>${row[2]}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="grid">
        <div class="panel">
          <h2 class="panel-title">Truy cập nhanh</h2>
          <div class="quick-stack">
            <a class="btn-secondary btn-block" href="/admin/article-edit.html">Viết bài mới</a>
            <a class="btn-secondary btn-block" href="/admin/projects.html">Cập nhật tiến độ</a>
            <a class="btn-secondary btn-block" href="/admin/leads.html">Xem lead mới</a>
            <a class="btn-secondary btn-block" href="/admin/site.html">Sửa nội dung site</a>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">Lead chưa liên hệ</h2>
          ${['Phạm Thị Hà|Ocean Park 3 · 09:42', 'Trần Quốc Hùng|Smart City · 08:15', 'Lê Mai Anh|Royal City · hôm qua'].map((item) => {
            const [name, meta] = item.split('|');
            return `<div class="lead-mini"><div><strong>${name}</strong><br><span class="muted">${meta}</span></div>${badge('Mới', 'new')}</div>`;
          }).join('')}
          <a class="btn-link" href="/admin/leads.html">Xem tất cả →</a>
        </div>
      </div>
    </div>
  `;
}

function renderArticles() {
  return `
    ${pageHeader('Bài viết', `
      <button class="btn-secondary js-export" type="button">Export CSV</button>
      <a class="btn-primary" href="/admin/article-edit.html">${icon.plus} Bài mới</a>
    `)}
    <div class="panel panel-table">
      ${filterBar('Tìm theo tiêu đề...', ['Tất cả trạng thái', 'Tác giả: tất cả'], '<button class="filter-chip" type="button">Sắp xếp: Cập nhật ↓</button>')}
      <table class="table">
        <thead><tr><th>Tiêu đề</th><th>Trạng thái</th><th>Tác giả</th><th>Cập nhật</th><th></th></tr></thead>
        <tbody>
          ${articleRows.map((row) => `<tr>
            <td><a href="/admin/article-edit.html"><strong>${row[0]}</strong></a><br><span class="muted mono">${row[1]}</span></td>
            <td>${badge(row[2], row[3])}</td>
            <td>${row[4]}</td>
            <td>${row[5]}</td>
            <td class="actions"><a class="btn-link" href="/admin/article-edit.html">Sửa</a> &nbsp; <button class="btn-link danger-text js-delete-row" type="button">Xóa</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${pagination('Hiển thị 1–8 trong 128 bài')}
    </div>
  `;
}

function renderArticleEdit() {
  return `
    ${pageHeader('Vinhomes Ocean Park 3 - Cập nhật tiến độ tháng 5/2026', `
      <a class="btn-secondary" href="/admin/articles.html">← Bài viết</a>
      <span class="muted">Autosave 12 giây trước</span>
      <button class="btn-secondary" type="button">Preview</button>
      <button class="btn-primary js-save" type="button">Lưu</button>
    `)}
    <div class="grid layout-edit">
      <div class="grid">
        <div class="panel">
          <div class="form-grid">
            <div class="field"><label>Tiêu đề</label><input value="Vinhomes Ocean Park 3 - Cập nhật tiến độ tháng 5/2026"></div>
            <div class="field"><label>Slug</label><input value="vinhomes-ocean-park-3-tien-do-thang-5-2026"></div>
          </div>
          <div class="field" style="margin-top:12px;"><label>Excerpt</label><textarea>Những cập nhật mới nhất về phân khu Sapphire, Block S2.01 và tiện ích nội khu tại Ocean Park 3.</textarea></div>
        </div>
        <div class="panel">
          <h2 class="panel-title">Nội dung bài viết</h2>
          <div class="editor-toolbar">
            ${['H2', 'H3', 'B', 'I', 'U', 'List', 'Link', 'Image', 'Table', 'Code'].map((tool) => `<button class="tool-btn" type="button">${tool}</button>`).join('')}
          </div>
          <div class="editor-body" contenteditable="true">
            <h2>Cất nóc tòa S2.01</h2>
            <p>Phân khu Sapphire tại Vinhomes Ocean Park 3 đã hoàn tất cất nóc đúng tiến độ. Các hạng mục hoàn thiện mặt ngoài, cảnh quan và nghiệm thu PCCC đang được triển khai đồng bộ.</p>
            <p>Dự kiến cư dân nhận bàn giao từ cuối quý 4/2026, cùng thời điểm các tiện ích Aqua Bay và tuyến shuttle nội khu đi vào vận hành.</p>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">SEO Metadata</h2>
          <div class="field"><label>Meta title</label><input value="Tiến độ Vinhomes Ocean Park 3 tháng 5/2026"></div>
          <div class="field" style="margin-top:12px;"><label>Meta description</label><textarea>Thông tin tiến độ mới nhất tại Ocean Park 3, bao gồm Sapphire S2.01, tiện ích nội khu và lịch bàn giao.</textarea></div>
          <div class="form-grid" style="margin-top:12px;">
            <div class="field"><label>Canonical</label><input value="https://vinhomes.vn/ocean-park-3-tien-do-thang-5-2026"></div>
            <div class="field"><label>OG image</label><input value="ocean-park-3-cover.webp"></div>
          </div>
        </div>
      </div>
      <aside class="grid">
        <div class="panel">
          <h2 class="panel-title">Xuất bản</h2>
          <div class="field"><label>Trạng thái</label><select><option>Đã đăng</option><option>Nháp</option><option>Lưu trữ</option></select></div>
          <button class="btn-primary btn-block js-save" type="button" style="margin-top:12px;">Lưu thay đổi</button>
          <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:8px;gap:8px;">
            <button class="btn-secondary" type="button">Archive</button>
            <button class="btn-secondary" type="button">Unpublish</button>
          </div>
        </div>
        <div class="panel">
          <h2 class="panel-title">Ảnh đại diện</h2>
          <div class="media-tile selected"><span class="format-tag">WebP</span><div class="media-meta"><strong>ocean-park-3-cover.webp</strong>2400×1600 · 412 KB</div></div>
        </div>
        <div class="panel">
          <h2 class="panel-title">Phân loại</h2>
          <div class="tag-list"><span class="tag">Vinhomes</span><span class="tag">Ocean Park 3</span><span class="tag">Tiến độ</span></div>
          <div class="field" style="margin-top:12px;"><label>Dự án</label><select><option>Vinhomes Ocean Park 3</option><option>Smart City</option></select></div>
        </div>
      </aside>
    </div>
  `;
}

function renderSections() {
  const sections = [
    ['hero_banner', 'Sống tại nơi trao trọn cuộc đời', 'home:hero · Cập nhật 2 ngày trước', 'Active', 'active', true],
    ['stat_grid', 'Con số khẳng định vị thế', 'home:stats · 4 thẻ số liệu', 'Active', 'active'],
    ['project_card_list', 'Dự án nổi bật', 'home:featured · 6 card · auto-fetch', 'Active', 'active'],
    ['feature_list', 'Tiện ích vượt trội', 'home:features · 8 mục', 'Active', 'active'],
    ['gallery_block', 'Khoảnh khắc cư dân', 'home:gallery · 12 ảnh', 'Ẩn', 'draft'],
    ['cta_block', 'Để lại thông tin - tư vấn ngay', 'home:cta · Form leads', 'Active', 'active'],
  ];
  return `
    ${pageHeader('Page Sections', `
      <div class="tabs"><a class="tab active" href="#">home</a><a class="tab" href="#">about</a><a class="tab" href="#">project-detail</a></div>
      <button class="btn-primary" type="button">${icon.plus} Section</button>
    `)}
    <div class="panel" style="padding:6px 16px;margin-bottom:16px;">Đổi text/CTA của block trên landing mà không cần sửa code. Frontend bind qua <code>data-cms-section="home:hero"</code>. Kéo thả để đổi thứ tự hiển thị.</div>
    <div class="grid">
      ${sections.map((s) => `
        <div class="section-card${s[5] ? ' expanded' : ''}">
          <div class="section-head">
            <span class="grip">⋮⋮</span>
            <span class="type-pill">${s[0]}</span>
            <div><strong>${s[1]}</strong><br><span class="muted">${s[2]}</span></div>
            ${badge(s[3], s[4])}
            <button class="icon-btn btn-icon" type="button">${icon.edit}</button>
          </div>
          <div class="section-body">
            <div class="form-grid">
              <div class="field"><label>Heading</label><input value="Sống tại nơi trao trọn cuộc đời"></div>
              <div class="field"><label>Sub-heading</label><input value="Khu đô thị đáng sống bậc nhất Việt Nam"></div>
              <div class="field"><label>CTA primary</label><input value="Khám phá dự án"></div>
              <div class="field"><label>CTA URL</label><input value="/du-an"></div>
            </div>
            <div class="field" style="margin-top:12px;"><label>Background image</label><div style="display:flex;gap:12px;align-items:center;"><div class="thumb-placeholder"></div><button class="btn-secondary" type="button">Chọn từ Media</button></div></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMedia() {
  return `
    ${pageHeader('Media Library', `<button class="btn-secondary" type="button">Tất cả · 248</button><button class="btn-primary" type="button">Upload ảnh</button>`)}
    <div class="dropzone" style="margin-bottom:16px;">
      <div class="upload-icon">${icon.upload}</div>
      <div><strong>Kéo thả ảnh vào đây - hoặc bấm để chọn</strong><br><span class="muted">Tự resize tối đa 2400px, convert WebP, strip EXIF. Original name giữ lại để dễ tìm.</span></div>
      <button class="btn-secondary right" type="button">Chọn file</button>
    </div>
    ${filterBar('Tìm theo tên ảnh...', ['Tất cả thư mục', 'Loại: tất cả'], '<span class="muted">2 ảnh đang chọn · </span><button class="btn-link danger-text js-delete-row" type="button">Xóa</button><span class="muted"> · </span><button class="btn-link js-export" type="button">Tải xuống</button>')}
    <div class="media-grid">
      ${mediaFiles.map((name, i) => `
        <div class="media-tile${i === 0 || i === 2 ? ' selected' : ''}">
          <span class="format-tag">WebP</span>
          <div class="media-meta"><strong>${name}</strong>${i === 2 ? '1920×1080 · 290 KB' : '2400×1600 · ' + (388 + i * 6) + ' KB'}</div>
        </div>
      `).join('')}
    </div>
    <div class="panel-table" style="margin-top:16px;">${pagination('Hiển thị 1–12 / 248 ảnh · Tổng dung lượng 94.6 MB', '21')}</div>
  `;
}

function renderLeads() {
  return `
    ${pageHeader('Leads', `<button class="btn-secondary js-export" type="button">Export CSV</button><button class="btn-primary" type="button">${icon.plus} Lead</button>`)}
    <div class="grid grid-5">
      ${stat('Tổng leads', '1,247', '▲ 84 tuần này')}
      ${stat('Mới', '4', 'cần liên hệ', 'info')}
      ${stat('Đã liên hệ', '312', '', 'warning')}
      ${stat('Chốt deal', '128', '▲ 12 trong 30 ngày')}
      ${stat('Tỉ lệ chốt', '10.3%', '▲ 1.4%')}
    </div>
    <div class="panel panel-table" style="margin-top:16px;">
      ${filterBar('Tìm theo tên / SĐT / email...', ['Tất cả trạng thái', 'Dự án: tất cả', '30 ngày gần nhất'])}
      <table class="table">
        <thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Dự án quan tâm</th><th>Nguồn</th><th>Trạng thái</th><th>Thời gian</th><th>Phụ trách</th><th></th></tr></thead>
        <tbody>
          ${leads.map((lead) => `<tr>
            <td><strong>${lead[0]}</strong><br><span class="muted">${lead[1]}</span></td>
            <td>${lead[2]}<br><span class="muted">${lead[3]}</span></td>
            <td>${lead[4]}</td><td>${lead[5]}</td><td>${badge(lead[6], lead[7])}</td><td>${lead[8]}</td><td>${lead[9]}</td><td class="actions"><button class="btn-link" type="button">${lead[10]}</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${pagination('Hiển thị 1–8 / 1,247 leads', '156')}
    </div>
  `;
}

function renderProjects() {
  const projects = [
    ['OP3', 'Vinhomes Ocean Park 3', 'Văn Giang, Hưng Yên · Bàn giao Q4/2026 · 12 milestones', 'Đang triển khai', 'active', 68, [
      ['done', 'Khởi công - Phân khu Sapphire', 'Hoàn thành 12/03/2025', '100%'],
      ['done', 'Đào móng cọc tòa S2.01', 'Hoàn thành 08/06/2025', '100%'],
      ['current', 'Cất nóc tòa S2.01', 'Đang thực hiện · dự kiến 28/05/2026', '82%'],
      ['', 'Hoàn thiện MEP S2.01', 'Lên kế hoạch · Q3/2026', '0%'],
    ]],
    ['SC', 'Vinhomes Smart City', 'Nam Từ Liêm, Hà Nội · Bàn giao Q2/2027 · 18 milestones', 'Đang triển khai', 'active', 42, [
      ['done', 'Hoàn thành The Miami', 'Bàn giao 20/12/2025', '100%'],
      ['current', 'Mở bán phân khu Hawaii', 'Đang thực hiện · 02/06/2026', '55%'],
      ['', 'Khởi công The Tonkin', 'Q3/2026', '0%'],
    ]],
    ['GP', 'Vinhomes Grand Park', 'Quận 9, TP.HCM · Bàn giao Q3/2026 · 22 milestones', 'Sắp bàn giao', 'warning', 91, [
      ['current', 'Hoàn thiện ngoại thất S10', 'Đang thực hiện · 14/06/2026', '88%'],
      ['', 'Nghiệm thu PCCC', 'Lên kế hoạch · 30/06/2026', '0%'],
    ]],
    ['RC', 'Vinhomes Royal City', 'Thanh Xuân, Hà Nội · Đã bàn giao · 6 milestones bảo trì', 'Vận hành', 'draft', 100, [
      ['done', 'Bảo trì hệ thống thang máy R3-R5', 'Hoàn thành 10/05/2026', '100%'],
      ['', 'Cải tạo Vincom Mega Mall', 'Q4/2026', '0%'],
    ]],
  ];
  return `
    ${pageHeader('Tiến độ dự án', `<button class="btn-secondary" type="button">Xem timeline tổng ↗</button><button class="btn-primary" type="button">${icon.plus} Dự án mới</button>`)}
    <div class="grid layout-2">
      ${projects.map((project) => `
        <div class="project-card">
          <div class="project-head">
            <div class="project-title-row">
              <div class="project-avatar">${project[0]}</div>
              <div><strong>${project[1]}</strong> ${badge(project[3], project[4])}<br><span class="muted">${project[2]}</span></div>
            </div>
            <div class="project-progress"><div class="progress ${project[5] === 100 ? 'success' : ''}"><span style="width:${project[5]}%"></span></div><strong>${project[5]}%</strong></div>
          </div>
          ${project[6].map((m) => `<div class="milestone"><span class="dot ${m[0]}"></span><div><strong>${m[1]}</strong><br><span class="muted">${m[2]}</span></div><span class="${m[0] === 'current' ? 'warning-text' : ''}">${m[3]}</span><button class="icon-btn" type="button">...</button></div>`).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function renderSite() {
  const nav = ['Thông tin chung', 'Hero & landing', 'Liên hệ & hotline', 'SEO mặc định', 'Social & OG', 'Form leads', 'Theme & màu sắc', 'Tích hợp', 'Footer & pháp lý'];
  return `
    ${pageHeader('Cấu hình Site', `<span class="muted">Frontend cache 60s</span><button class="btn-secondary" type="button">Hoàn tác</button><button class="btn-primary js-save" type="button">Lưu thay đổi</button>`)}
    <div class="grid layout-settings">
      <nav class="settings-nav">${nav.map((item, i) => `<a class="${i === 0 ? 'active' : ''}" href="#">${item}</a>`).join('')}</nav>
      <div class="grid">
        <div class="panel"><h2 class="panel-title">Thông tin chung</h2><div class="form-grid">
          <div class="field"><label>Tên thương hiệu</label><input value="Vinhomes"></div><div class="field"><label>Tagline</label><input value="Sống tại nơi trao trọn cuộc đời"></div>
          <div class="field"><label>Domain chính</label><input value="vinhomes.vn"></div><div class="field"><label>Ngôn ngữ mặc định</label><select><option>Tiếng Việt (vi)</option></select></div>
        </div><div class="field" style="margin-top:12px;"><label>Logo</label><div style="display:flex;gap:12px;align-items:center;"><div class="brand-mark" style="width:48px;height:48px;border-radius:10px;">${icon.logo}</div><button class="btn-secondary" type="button">Đổi logo</button><span class="muted">SVG ưu tiên · 1:1 ratio</span></div></div></div>
        <div class="panel"><h2 class="panel-title">Liên hệ & hotline</h2><div class="form-grid">
          <div class="field"><label>Hotline 24/7</label><input value="1800 6868"></div><div class="field"><label>Email CSKH</label><input value="cskh@vinhomes.vn"></div>
          <div class="field"><label>Địa chỉ trụ sở</label><input value="Số 7 Bằng Lăng 1, Vinhomes Riverside, Long Biên, Hà Nội"></div><div class="field"><label>Facebook Page</label><input value="https://fb.com/vinhomes.official"></div>
          <div class="field"><label>Zalo OA</label><input value="https://zalo.me/vinhomes"></div>
        </div></div>
        <div class="panel"><h2 class="panel-title">SEO mặc định</h2><div class="field"><label>Meta title pattern</label><input value="{page_title} | Vinhomes"></div><div class="field" style="margin-top:12px;"><label>Meta description mặc định</label><textarea>Vinhomes - chủ đầu tư khu đô thị hàng đầu Việt Nam. Khám phá hệ thống đại đô thị đẳng cấp với tiện ích vượt trội.</textarea></div><div class="form-grid" style="margin-top:12px;"><div class="field"><label>Google Analytics ID</label><input value="G-XXXXXXXXXX"></div><div class="field"><label>Search Console</label><input value="vinhomes.vn ✓ verified"></div></div></div>
        <div class="panel"><h2 class="panel-title">Form leads - Cấu hình</h2><p class="muted">Webhook gửi khi có lead mới. Dùng để sync sang CRM.</p><div class="field"><label>Webhook URL</label><input value="https://crm.vinhomes.vn/api/leads/intake"></div><div class="form-grid" style="margin-top:12px;"><div class="field"><label>Email nhận thông báo</label><input value="sales@vinhomes.vn"></div><div class="field"><label>SMS + Email confirm</label><button class="toggle on" type="button"><span></span></button></div><div class="field"><label>reCAPTCHA</label><button class="toggle" type="button"><span></span></button></div></div></div>
      </div>
    </div>
  `;
}

function renderUsers() {
  const users = [
    ['A', 'admin@vinhomes.vn', 'Nguyễn Minh Quân · Bạn', 'Admin', 'admin', 'Hoạt động', 'active', 'Bây giờ', '12/03/2024', true],
    ['T', 'thu@vinhomes.vn', 'Đỗ Minh Thu', 'Admin', 'admin', 'Hoạt động', 'active', '22/05/2026 09:14', '04/06/2024'],
    ['L', 'linh@vinhomes.vn', 'Trần Khánh Linh', 'Editor', 'editor', 'Hoạt động', 'active', '22/05/2026 10:42', '12/09/2024'],
    ['Q', 'quang@vinhomes.vn', 'Lê Hoàng Quang', 'Editor', 'editor', 'Hoạt động', 'active', '21/05/2026 18:30', '02/11/2024'],
    ['M', 'my.nguyen@vinhomes.vn', 'Nguyễn Hà My', 'Editor', 'editor', 'Chờ xác minh', 'pending', '-', '20/05/2026'],
    ['D', 'duc.tran@vinhomes.vn', 'Trần Anh Đức', 'Editor', 'editor', 'Hoạt động', 'active', '20/05/2026 14:08', '15/01/2025'],
    ['H', 'huyle@vinhomes.vn', 'Lê Minh Huy', 'Viewer', 'viewer', 'Hoạt động', 'active', '18/05/2026 11:22', '01/02/2025'],
    ['P', 'phong.bui@vinhomes.vn', 'Bùi Tiến Phong', 'Viewer', 'viewer', 'Tạm khóa', 'danger', '10/04/2026 09:00', '20/03/2025'],
  ];
  return `
    ${pageHeader('Quản lý User', `<button class="btn-secondary" type="button">Mời qua email</button><button class="btn-primary" type="button">${icon.plus} User mới</button>`)}
    <div class="grid grid-4">${stat('Tổng users', '12', 'trong tenant này', '')}${stat('Admin', '2', 'full access', 'warning')}${stat('Editor', '7', 'không sửa site')}${stat('Viewer', '3', 'read-only', '')}</div>
    <div class="panel panel-table" style="margin-top:16px;">
      ${filterBar('Tìm theo email...', ['Tất cả role', 'Tất cả trạng thái'])}
      <table class="table"><thead><tr><th>Người dùng</th><th>Role</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th>Tạo lúc</th><th></th></tr></thead><tbody>
        ${users.map((u) => `<tr><td><div style="display:flex;gap:10px;align-items:center;"><span class="avatar">${u[0]}</span><div><strong>${u[1]}</strong><br><span class="muted">${u[2]}</span></div></div></td><td>${badge(u[3], u[4])}</td><td>${badge(u[5], u[6])}</td><td>${u[7]}</td><td>${u[8]}</td><td class="actions"><a class="btn-link" href="#">Sửa</a>${u[9] ? '' : ' &nbsp; <button class="btn-link danger-text js-delete-row" type="button">Xóa</button>'}</td></tr>`).join('')}
      </tbody></table>${pagination('Hiển thị 1–8 / 12 users', '2')}</div>
  `;
}

function renderTenants() {
  const tenants = [
    ['V', '#C97A1F', 'Vinhomes', 'Tenant chính', 'vinhomes.vn', 'Pro+', 'proplus', '12', '128', 'Hoạt động', 'active', '12/03/2024', 'Mở'],
    ['M', '#3B82C4', 'Masterise Homes', 'Tenant đối tác', 'masterisehomes.com', 'Pro', 'pro', '8', '94', 'Hoạt động', 'active', '04/06/2024', 'Mở'],
    ['S', '#3AA876', 'Sun Group', 'Tenant đối tác', 'sungroup.com.vn', 'Standard', 'info', '5', '62', 'Hoạt động', 'active', '20/08/2024', 'Mở'],
    ['N', '#D7B321', 'Novaland', 'Tenant đối tác', 'novaland.com.vn', 'Lite', 'info', '3', '28', 'Sắp hết hạn', 'warning', '15/11/2024', 'Gia hạn'],
    ['E', '#D65A5A', 'Ecopark', 'Demo', 'demo.ecopark.com.vn', 'Community', 'community', '1', '4', 'Hết hạn', 'danger', '02/03/2025', 'Xóa'],
  ];
  return `
    ${pageHeader('Quản lý Tenants', `<button class="btn-secondary" type="button">Import CSV</button><button class="btn-primary" type="button">${icon.plus} Tenant mới</button>`)}
    <div class="panel" style="padding:6px 16px;margin-bottom:16px;">Mỗi tenant = một website CMS độc lập, cùng database nhưng data hoàn toàn cách ly. Tạo tenant mới = clone CMS thêm 1 instance, không cần redeploy. <span class="danger-text">Xóa tenant sẽ CASCADE xóa toàn bộ data</span> - không thể undo.</div>
    <div class="panel panel-table">
      ${filterBar('Tìm theo domain / tên...', ['Tất cả gói', 'Tất cả trạng thái'])}
      <table class="table"><thead><tr><th>Tenant</th><th>Domain</th><th>Plan</th><th>Users</th><th>Bài viết</th><th>Trạng thái</th><th>Tạo lúc</th><th></th></tr></thead><tbody>
        ${tenants.map((t) => `<tr><td><div style="display:flex;gap:10px;align-items:center;"><span class="tenant-mark" style="background:${t[1]}">${t[0]}</span><div><strong>${t[2]}</strong><br><span class="muted">${t[3]}</span></div></div></td><td class="mono">${t[4]}</td><td>${badge(t[5], t[6])}</td><td>${t[7]}</td><td>${t[8]}</td><td>${badge(t[9], t[10])}</td><td>${t[11]}</td><td class="actions"><a class="btn-link" href="#">${t[12]}</a> &nbsp; <a class="btn-link" href="#">Sửa</a></td></tr>`).join('')}
      </tbody></table>${pagination('Hiển thị 5 tenant', '1')}</div>
  `;
}

function renderAudit() {
  const events = [
    ['22/05/2026 10:42:18', 'linh@vinhomes.vn', 'article.publish', 'Đăng bài "Vinhomes Ocean Park 3 - Tiến độ tháng 5/2026" (id=128)', '10.20.4.12'],
    ['22/05/2026 10:38:22', 'linh@vinhomes.vn', 'article.update', 'Sửa bài id=128 · 4 trường thay đổi (title, content, status, meta_title)', '10.20.4.12'],
    ['22/05/2026 09:42:01', '(public)', 'lead.create', 'Lead mới #1247 - Phạm Thị Hà · Ocean Park 3 · nguồn: facebook_ads', '222.252.18.4'],
    ['22/05/2026 09:14:53', 'thu@vinhomes.vn', 'auth.login', 'Đăng nhập thành công · TOTP verified · session=2h', '113.184.22.78'],
    ['22/05/2026 09:11:00', 'admin@vinhomes.vn', 'site.update', 'Đổi hotline: "1900 9999" → "1800 6868"', '10.20.4.1'],
    ['22/05/2026 08:45:30', 'quang@vinhomes.vn', 'milestone.update', 'Cập nhật milestone "Cất nóc tòa S2.01" · progress 78% → 82%', '10.20.4.45'],
    ['22/05/2026 08:15:12', '(public)', 'lead.create', 'Lead mới #1246 - Trần Quốc Hùng · Smart City · nguồn: google_ads', '14.169.55.201'],
    ['22/05/2026 07:00:00', '(system)', 'system.backup', 'DB snapshot OK · 412 MB · uploaded to s3://omniplug-backup/vinhomes/', '-'],
    ['21/05/2026 22:33:44', '(public)', 'lead.create', 'Lead mới #1245 - Lê Mai Anh · Royal City · nguồn: webform', '123.16.78.221'],
    ['21/05/2026 16:08:11', 'linh@vinhomes.vn', 'media.upload', 'Upload 14 ảnh (3 WebP, 11 JPEG → WebP) · tổng 5.8 MB', '10.20.4.12'],
    ['21/05/2026 11:22:18', 'admin@vinhomes.vn', 'user.invite', 'Mời my.nguyen@vinhomes.vn · role=editor', '10.20.4.1'],
    ['20/05/2026 09:01:45', 'thu@vinhomes.vn', 'auth.password_change', 'Đổi mật khẩu thành công', '113.184.22.78'],
  ];
  return `
    ${pageHeader('Audit Log', `<button class="btn-secondary js-export" type="button">Export JSON</button><button class="btn-secondary" type="button">Refresh</button>`)}
    <div class="panel" style="padding:6px 16px;margin-bottom:16px;">Mọi hành động ghi vào DB đều có log: ai làm gì, lúc nào, từ IP nào. Logs immutable - không xóa được từ UI.</div>
    <div class="panel panel-table">
      ${filterBar('Tìm theo email / IP / target...', ['Tất cả actions', 'User: tất cả', '24 giờ qua'])}
      <table class="table"><thead><tr><th>Thời gian</th><th>User</th><th>Action</th><th>Chi tiết</th><th>IP</th></tr></thead><tbody>
        ${events.map((e, i) => `<tr><td>${e[0]}</td><td>${e[1]}</td><td><span class="audit-action ${['warning-text','info-text','success-text','danger-text'][i % 4]}"><span class="audit-dot"></span><span class="code-pill">${e[2]}</span></span></td><td>${e[3]}</td><td class="mono">${e[4]}</td></tr>`).join('')}
      </tbody></table>${pagination('Hiển thị 12 events · 4,628 total', '386')}</div>
  `;
}

function renderLicense() {
  return `
    <div class="license-hero" style="margin-bottom:16px;">
      <div class="license-mark">${icon.license}</div>
      <div><div style="display:flex;gap:8px;align-items:center;"><span class="plan-pill">PRO PLUS</span>${badge('Đã kích hoạt', 'active')}</div><h1 style="margin:10px 0 3px;font-size:22px;">vinhomes.vn · Tenant chính</h1><div class="muted">Hợp đồng tự gia hạn - hết hạn <strong>31/12/2026</strong> · còn <span class="warning-text">223 ngày</span></div></div>
      <div style="text-align:right;"><div class="muted">Hóa đơn kế tiếp</div><div style="font-size:26px;font-weight:600;">48,000,000đ</div><div class="muted">VAT đã bao gồm</div></div>
    </div>
    <div class="grid layout-rail">
      <div class="grid">
        <div class="panel"><h2 class="panel-title">Thông tin license</h2><div class="kv-grid">
          <div>License ID (jti)</div><div class="mono">lic_01HZ7Q3XKD8M9A2F4B6C8D0E2G</div>
          <div>Issued at</div><div class="mono">01/01/2026 00:00:00 (UTC+7)</div>
          <div>Expires at</div><div class="mono">31/12/2026 23:59:59 (UTC+7)</div>
          <div>Bound domain</div><div class="mono">vinhomes.vn</div>
          <div>Signature alg</div><div class="mono">RS256 · vendor=OmniPlug, kid=op-2026-01</div>
          <div>CRL last sync</div><div class="mono">22/05/2026 07:00:00 · 0 revocations applied</div>
        </div></div>
        <div class="panel"><h2 class="panel-title">Kích hoạt license mới</h2><p class="muted">Dán chuỗi JWT mà OmniPlug cấp cho bạn. Mỗi license gắn với 1 domain - hệ thống sẽ kiểm tra trùng khớp trước khi kích hoạt.</p><textarea class="mono" style="min-height:110px;">eyJhbGciOiJSUzI1NiIsImtpZCI6Im9wLTIwMjYtMDEifQ.eyJqdGkiOiJsaWNfMDFIWjdRM1hLRDhNOUFXRjRCNkQ4RDBFMkciLCJpc3MiOiJvbW5pcGx1ZyIsInBsYW4iOiJwcm9fcGx1cyIsImRvbWFpbiI6InZpbmhvbWVzLnZuIiwiaWF0IjoxNzM1Njg5NjAwLCJleHAiOjE3NjcxMzQxMX0.signature_placeholder_redacted_for_display_purposes_only</textarea><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn-primary js-license-activate" type="button">Kích hoạt</button><button class="btn-secondary js-license-activate" type="button">Verify only</button><span class="success-text" style="align-self:center;">JWT đã verify thành công · domain match ✓</span></div></div>
        <div class="panel"><h2 class="panel-title">Đồng bộ Revocation List (CRL)</h2><p class="muted">OmniPlug gửi file CRL đã ký số khi cần thu hồi license. Dán JSON đã ký vào đây - hệ thống tự verify chữ ký rồi áp dụng.</p><textarea class="mono" style="min-height:96px;">{"crl":[],"crl_signature":"..."}</textarea><button class="btn-secondary js-crl-sync" type="button" style="margin-top:12px;">Đồng bộ CRL</button></div>
      </div>
      <aside class="grid">
        <div class="panel"><h2 class="panel-title">Quota & sử dụng</h2>${quota('Bài viết', '128 / 1,000', 13)}${quota('Media storage', '94.6 MB / 50 GB', 5)}${quota('API calls / tháng', '1.2M / Unlimited', 30)}${quota('Users', '12 / Unlimited', 20)}</div>
        <div class="panel"><h2 class="panel-title">Tính năng gói Pro Plus</h2>${['Multi-tenant không giới hạn','SSO + SAML','Audit log 7 năm','CDN ảnh toàn cầu','Webhook tới CRM','Hỗ trợ ưu tiên 24/7'].map((f) => `<div class="feature-row"><span class="success-text">✓</span><span>${f}</span></div>`).join('')}<div class="feature-row disabled"><span>—</span><span>White-label CMS shell</span></div></div>
        <div class="panel"><h2 class="panel-title">Hỗ trợ</h2><p>Cần hỗ trợ kích hoạt hoặc nâng cấp? Liên hệ:</p><p><a class="btn-link" href="mailto:support@omniplug.com">support@omniplug.com</a></p><a class="btn-link" href="#">Tài liệu license →</a></div>
      </aside>
    </div>
  `;
}

function quota(label, value, pct) {
  return `<div class="quota-row"><div class="quota-label"><span>${label}</span><strong>${value}</strong></div><div class="progress"><span style="width:${pct}%"></span></div></div>`;
}
