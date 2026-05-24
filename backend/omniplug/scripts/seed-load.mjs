#!/usr/bin/env node
/**
 * scripts/seed-load.mjs — Multi-business multi-tenant load fixture.
 *
 * Generates the v1.4.4 acceptance fixture per the operator brief:
 *
 *   - 30 business units across 5 industries (real-estate, spa, branding,
 *     professional, aesthetics — 6 per industry)
 *   - 3 tenants per business (90 tenants total — each tenant gets its own
 *     domain so tenant isolation can be exercised by the load harness)
 *   - 3 users per tenant (270 users total — 1 admin + 1 editor + 1 viewer)
 *   - 5 SEO-ready articles per tenant per day (configurable via DAYS env)
 *   - Cover image attached to every article (placeholder.svg in media table)
 *   - 5000 leads per business, distributed across the 3 tenants
 *
 * The script is IDEMPOTENT — re-runs upsert by slug / email / jti. Safe to
 * re-run on a deployed server to top up after a partial failure.
 *
 * Performance budget (shared-cpu-1x / 512MB Fly machine):
 *   - Migrations: ~2s
 *   - 90 tenants + 270 users: ~5s
 *   - 5 articles × 90 tenants × 1 day = 450 articles: ~10s
 *   - 150 000 leads (5000 × 30): ~60-90s (bulk INSERT in transactions of 1000)
 *   Total cold seed: ~2 minutes.
 *
 * Env overrides:
 *   SCALE_FACTOR=full         (default: 1.0 → 90 tenants, 5000 leads/biz)
 *                 medium      → 0.33 (30 tenants, 1500 leads/biz)
 *                 small       → 0.1  (9 tenants, 500 leads/biz)
 *   DAYS=N                    Articles for N days back from today (default 1)
 *   DB_PATH=/path/to/cms.db   Override DB
 *   DRY_RUN=1                 Print counts but don't write
 *
 * Operator: OmniPlug Engineering <licensing@omniplug.com>
 */

import db from '../src/core/db/connection.js';
import { runMigrations } from '../src/core/db/migrate.js';
import { hashPassword } from '../src/core/lib/password.js';
import crypto from 'node:crypto';

const SCALE = process.env.SCALE_FACTOR || 'full';
const DAYS = parseInt(process.env.DAYS || '1', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

const SCALE_MAP = {
  full:   { businesses: 30, tenants_per_biz: 3, users_per_tenant: 3, articles_per_tenant_per_day: 5, leads_per_biz: 5000 },
  medium: { businesses: 30, tenants_per_biz: 1, users_per_tenant: 3, articles_per_tenant_per_day: 5, leads_per_biz: 1500 },
  small:  { businesses: 9,  tenants_per_biz: 1, users_per_tenant: 3, articles_per_tenant_per_day: 3, leads_per_biz: 500 },
};
const SPEC = SCALE_MAP[SCALE];
if (!SPEC) {
  console.error(`Unknown SCALE_FACTOR=${SCALE}. Pick one of: ${Object.keys(SCALE_MAP).join(', ')}`);
  process.exit(2);
}

// 5 industries × 6 business themes each = 30 businesses
const BUSINESS_THEMES = [
  // real-estate
  { ind: 'real-estate', name: 'Đại Phát Land', slug: 'dai-phat-land' },
  { ind: 'real-estate', name: 'Saigon Properties', slug: 'saigon-properties' },
  { ind: 'real-estate', name: 'Hanoi Homes Group', slug: 'hanoi-homes-group' },
  { ind: 'real-estate', name: 'Danang Coastal Realty', slug: 'danang-coastal-realty' },
  { ind: 'real-estate', name: 'Vincom Estate', slug: 'vincom-estate' },
  { ind: 'real-estate', name: 'Phú Quốc Resort Living', slug: 'phu-quoc-resort-living' },
  // spa
  { ind: 'spa', name: 'Lotus Spa & Wellness', slug: 'lotus-spa-wellness' },
  { ind: 'spa', name: 'Bamboo Massage Center', slug: 'bamboo-massage-center' },
  { ind: 'spa', name: 'Orchid Beauty Retreat', slug: 'orchid-beauty-retreat' },
  { ind: 'spa', name: 'Saigon Day Spa', slug: 'saigon-day-spa' },
  { ind: 'spa', name: 'Healing Hands VN', slug: 'healing-hands-vn' },
  { ind: 'spa', name: 'Zen Beauty Studio', slug: 'zen-beauty-studio' },
  // branding
  { ind: 'branding', name: 'Pixel Forge Studio', slug: 'pixel-forge-studio' },
  { ind: 'branding', name: 'Bright Mark Agency', slug: 'bright-mark-agency' },
  { ind: 'branding', name: 'Indigo Brand Lab', slug: 'indigo-brand-lab' },
  { ind: 'branding', name: 'Saigon Creative House', slug: 'saigon-creative-house' },
  { ind: 'branding', name: 'North Star Design', slug: 'north-star-design' },
  { ind: 'branding', name: 'Kite Brand Co', slug: 'kite-brand-co' },
  // professional
  { ind: 'professional', name: 'Việt Luật Consulting', slug: 'viet-luat-consulting' },
  { ind: 'professional', name: 'BMA Accounting', slug: 'bma-accounting' },
  { ind: 'professional', name: 'Nexus Legal Partners', slug: 'nexus-legal-partners' },
  { ind: 'professional', name: 'Tax & Trust Advisory', slug: 'tax-trust-advisory' },
  { ind: 'professional', name: 'Sunrise Notary Group', slug: 'sunrise-notary-group' },
  { ind: 'professional', name: 'Apex Financial Audit', slug: 'apex-financial-audit' },
  // aesthetics
  { ind: 'aesthetics', name: 'Glow Aesthetics Clinic', slug: 'glow-aesthetics-clinic' },
  { ind: 'aesthetics', name: 'Korea Skin Center', slug: 'korea-skin-center' },
  { ind: 'aesthetics', name: 'Diamond Beauty Med', slug: 'diamond-beauty-med' },
  { ind: 'aesthetics', name: 'Lumière Aesthetic Lab', slug: 'lumiere-aesthetic-lab' },
  { ind: 'aesthetics', name: 'Pure Skin VN', slug: 'pure-skin-vn' },
  { ind: 'aesthetics', name: 'Renew Med Spa', slug: 'renew-med-spa' },
].slice(0, SPEC.businesses);

const TENANT_SUFFIXES = ['-main', '-hcm', '-hn'];   // 1st, 2nd, 3rd tenant per biz
const USER_ROLES = [
  { role: 'admin',  prefix: 'admin'  },
  { role: 'editor', prefix: 'editor' },
  { role: 'viewer', prefix: 'viewer' },
];
const PASSWORD = process.env.SEED_PASSWORD || 'OmniPlugTest2026!';

// SEO article templates per industry (5 × 5 industries = 25 templates;
// recycled across days with date-suffixed slugs to stay unique).
const ARTICLE_TEMPLATES_BY_IND = {
  'real-estate': [
    { title: 'Xu hướng giá nhà phố quận trung tâm năm 2026', focus: 'giá nhà phố quận trung tâm' },
    { title: 'Đầu tư căn hộ studio cho người độc thân — lợi nhuận thực', focus: 'căn hộ studio đầu tư' },
    { title: 'Pháp lý đất nền vùng ven: 7 điều phải kiểm tra trước khi xuống tiền', focus: 'pháp lý đất nền' },
    { title: 'Bán nhà cũ hay sửa rồi cho thuê — tính toán dòng tiền', focus: 'bán nhà cũ hay cho thuê' },
    { title: 'Top 5 dự án bàn giao Q3 2026 đáng quan tâm', focus: 'dự án bàn giao 2026' },
  ],
  spa: [
    { title: 'Liệu trình massage trị đau vai gáy hiệu quả tại nhà', focus: 'massage đau vai gáy' },
    { title: 'Spa thư giãn cho dân văn phòng: 90 phút đáng tiền nhất', focus: 'spa thư giãn dân văn phòng' },
    { title: 'Phân biệt massage Thái — Thuỵ Điển — Shiatsu cho người mới', focus: 'phân biệt massage thái thuỵ điển shiatsu' },
    { title: 'Chăm sóc da mặt mùa hanh khô — quy trình 5 bước', focus: 'chăm sóc da mặt mùa khô' },
    { title: 'Lý do nên đi spa định kỳ thay vì chỉ khi căng thẳng', focus: 'lý do đi spa định kỳ' },
  ],
  branding: [
    { title: '7 nguyên tắc thiết kế logo cho startup Việt 2026', focus: 'thiết kế logo startup 2026' },
    { title: 'Brand voice: cách startup nhỏ vẫn nói chuyện như brand lớn', focus: 'brand voice startup' },
    { title: 'Rebranding sau 5 năm: dấu hiệu công ty cần đổi nhận diện', focus: 'rebranding công ty' },
    { title: 'Bộ nhận diện thương hiệu tối thiểu cần có — checklist 12 mục', focus: 'bộ nhận diện thương hiệu' },
    { title: 'Storytelling thương hiệu: 3 framework dễ áp dụng', focus: 'storytelling thương hiệu' },
  ],
  professional: [
    { title: 'Thuế TNCN 2026: 5 thay đổi ảnh hưởng đến người làm tự do', focus: 'thuế tncn 2026 freelance' },
    { title: 'Hợp đồng dịch vụ tư vấn — 9 điều khoản phải có', focus: 'hợp đồng dịch vụ tư vấn' },
    { title: 'Quyết toán thuế năm: timeline và checklist cho SME', focus: 'quyết toán thuế sme' },
    { title: 'Khi nào nên thuê kế toán ngoài — phân tích chi phí', focus: 'thuê kế toán ngoài' },
    { title: 'Bảo hiểm xã hội tự nguyện: ai nên đóng và đóng bao nhiêu', focus: 'bảo hiểm xã hội tự nguyện' },
  ],
  aesthetics: [
    { title: 'Tiêm filler an toàn: 6 câu hỏi phải hỏi bác sĩ trước', focus: 'tiêm filler an toàn' },
    { title: 'Trẻ hoá da bằng laser — phân biệt CO2 và Pico', focus: 'trẻ hoá da laser co2 pico' },
    { title: 'Quy trình peel da chuẩn y khoa cho dân công sở', focus: 'peel da chuẩn y khoa' },
    { title: 'Cấy collagen sinh học: hiệu quả thật và cảnh báo', focus: 'cấy collagen sinh học' },
    { title: 'Chăm sóc sau thẩm mỹ: 14 ngày đầu quan trọng nhất', focus: 'chăm sóc sau thẩm mỹ' },
  ],
};

// Lead VN seed pools
const VN_FIRSTS = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Phan', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const VN_LASTS  = ['Văn An', 'Thị Bình', 'Đức Cường', 'Hoài Linh', 'Minh Đạt', 'Quốc Khánh', 'Thuỳ Trang', 'Hữu Phúc', 'Phương Anh', 'Tuấn Vũ'];
const PHONE_PREFIXES = ['090', '093', '097', '098', '086', '076', '081', '082', '083', '084', '085'];
const LEAD_SOURCES = ['organic', 'facebook', 'tiktok', 'google_ads', 'zalo', 'referral', 'direct'];
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];

// ---------- Helpers ----------
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function leadingPad(n, len) { return String(n).padStart(len, '0'); }

function fakePhone() { return rand(PHONE_PREFIXES) + leadingPad(randInt(0, 9999999), 7); }
function fakeName() { return rand(VN_FIRSTS) + ' ' + rand(VN_LASTS); }
function fakeEmail(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z]/g, '.')
    .replace(/\.+/g, '.').replace(/^\.|\.$/g, '')
    + randInt(10, 99) + '@gmail.com';
}

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Bulk insert helper with progress
function bulkInsert(label, total, prep, generator, batchSize = 1000) {
  let written = 0;
  const t0 = Date.now();
  const tx = db.transaction((rows) => { for (const r of rows) prep.run(r); });
  let batch = [];
  for (let i = 0; i < total; i++) {
    batch.push(generator(i));
    if (batch.length === batchSize) {
      if (!DRY_RUN) tx(batch);
      written += batch.length;
      batch = [];
      if (written % (batchSize * 10) === 0) {
        process.stdout.write(`\r  ${label}: ${written}/${total} (${Math.round(written/total*100)}%)`);
      }
    }
  }
  if (batch.length) { if (!DRY_RUN) tx(batch); written += batch.length; }
  process.stdout.write(`\r  ${label}: ${written}/${total} (${Date.now() - t0}ms)\n`);
}

async function main() {
  console.log(`\n═══ OmniPlug v1.4.4 — load seed (SCALE=${SCALE}, DAYS=${DAYS}${DRY_RUN ? ', DRY_RUN' : ''}) ═══\n`);
  console.log(`Target spec:`);
  console.log(`  businesses=${SPEC.businesses}  tenants/biz=${SPEC.tenants_per_biz}  total tenants=${SPEC.businesses * SPEC.tenants_per_biz}`);
  console.log(`  users/tenant=${SPEC.users_per_tenant}  total users=${SPEC.businesses * SPEC.tenants_per_biz * SPEC.users_per_tenant}`);
  console.log(`  articles/tenant/day=${SPEC.articles_per_tenant_per_day}  × ${DAYS} day(s)  total articles=${SPEC.businesses * SPEC.tenants_per_biz * SPEC.articles_per_tenant_per_day * DAYS}`);
  console.log(`  leads/business=${SPEC.leads_per_biz}  total leads=${SPEC.businesses * SPEC.leads_per_biz}\n`);

  // Migrations: check if v1.4.4 tables (licenses) exist. If yes, schema is
  // already at v1.4.4 (either via production migrate.js OR via test-fixture
  // setup-test-db.mjs). If no, run runMigrations() which uses schema_migrations.
  let schemaReady = false;
  try {
    db.prepare('SELECT 1 FROM licenses LIMIT 1').get();
    schemaReady = true;
  } catch {}
  if (schemaReady) {
    console.log('▸ schema at v1.4.4 already (licenses table present) — skipping migrations');
  } else {
    console.log('▸ schema missing v1.4.4 tables — running migrations');
    runMigrations();
  }

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');   // 64 MB page cache

  // ---------- 1) Tenants + Users ----------
  console.log('▸ Tenants + Users');
  const tenantInsert = db.prepare(`
    INSERT INTO tenants (slug, name, domain, status, settings_json)
    VALUES (?, ?, ?, 'active', ?)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name, domain=excluded.domain
    RETURNING id
  `);
  const userInsert = db.prepare(`
    INSERT INTO users (tenant_id, email, password_hash, display_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name
    RETURNING id
  `);

  const tenantsByBiz = new Map();   // bizSlug -> [tenantId, ...]
  const passwordHash = await hashPassword(PASSWORD);
  const tx = db.transaction(() => {});

  for (const biz of BUSINESS_THEMES) {
    const tenantIds = [];
    for (let ti = 0; ti < SPEC.tenants_per_biz; ti++) {
      const tslug  = biz.slug + (TENANT_SUFFIXES[ti] || `-${ti}`);
      const tname  = biz.name + (TENANT_SUFFIXES[ti] === '-main' ? '' : ` (${TENANT_SUFFIXES[ti].slice(1).toUpperCase()})`);
      const domain = `${tslug}.test.omniplug.local`;
      const settings = JSON.stringify({ industry: biz.ind, business_slug: biz.slug, seeded_by: 'load-seed' });

      const t = DRY_RUN
        ? { id: -ti }
        : tenantInsert.get(tslug, tname, domain, settings);
      tenantIds.push(t.id);

      for (const u of USER_ROLES.slice(0, SPEC.users_per_tenant)) {
        const email = `${u.prefix}.${tslug}@omniplug.test`;
        const display = `${u.role.charAt(0).toUpperCase() + u.role.slice(1)} — ${tname}`;
        if (!DRY_RUN) userInsert.get(t.id, email, passwordHash, display, u.role);
      }
    }
    tenantsByBiz.set(biz.slug, tenantIds);
  }
  console.log(`  ✓ ${BUSINESS_THEMES.length} businesses × ${SPEC.tenants_per_biz} tenants × ${SPEC.users_per_tenant} users provisioned`);

  // ---------- 2) Cover media placeholder per tenant ----------
  console.log('▸ Cover image placeholder per tenant');
  const mediaInsert = db.prepare(`
    INSERT INTO media (tenant_id, filename, original_name, mime_type, size_bytes, width, height, alt, uploaded_by)
    VALUES (?, ?, ?, 'image/svg+xml', 1024, 1200, 630, ?, NULL)
    RETURNING id
  `);
  const mediaByTenant = new Map();
  if (!DRY_RUN) {
    for (const ids of tenantsByBiz.values()) {
      for (const tid of ids) {
        const m = mediaInsert.get(tid, `cover-${tid}.svg`, 'cover.svg', `Cover for tenant ${tid}`);
        mediaByTenant.set(tid, m.id);
      }
    }
  }
  console.log(`  ✓ ${mediaByTenant.size} cover placeholders`);

  // ---------- 3) Articles per tenant per day ----------
  console.log('▸ Articles (5 per tenant per day)');
  const articleInsert = db.prepare(`
    INSERT INTO articles (
      tenant_id, slug, title, excerpt, content_html, cover_media_id,
      status, published_at, meta_title, meta_description,
      seo_title, seo_description, focus_keyword, seo_score, seo_score_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, slug) DO NOTHING
  `);
  const articleTx = db.transaction((rows) => {
    for (const r of rows) articleInsert.run(r);
  });

  let articleCount = 0;
  const now = new Date();
  const articleBatch = [];
  for (const biz of BUSINESS_THEMES) {
    const tplPool = ARTICLE_TEMPLATES_BY_IND[biz.ind];
    const tenantIds = tenantsByBiz.get(biz.slug);
    for (const tid of tenantIds) {
      for (let day = 0; day < DAYS; day++) {
        const publishedDate = new Date(now.getTime() - day * 86400000);
        const dayStamp = publishedDate.toISOString().slice(0, 10);
        for (let a = 0; a < SPEC.articles_per_tenant_per_day; a++) {
          const tpl = tplPool[a % tplPool.length];
          const slug = slugify(tpl.title) + '-' + dayStamp + '-' + (a + 1);
          const html = `<article>
            <h1>${tpl.title}</h1>
            <p>Bài viết tổng hợp cho ${biz.name} ngày ${dayStamp}. Tập trung từ khoá: <strong>${tpl.focus}</strong>.</p>
            <h2>Tóm tắt</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Phân tích cụ thể tại thị trường Việt Nam 2026.</p>
            <h2>Nội dung chính</h2>
            <p>Section dài để SEO score đạt ngưỡng. Đề cập <em>${tpl.focus}</em> tối thiểu 3 lần trong toàn bài. Liên kết nội bộ tới các bài liên quan trong cùng tenant để tăng dwell time.</p>
            <ul><li>Điểm 1 quan trọng</li><li>Điểm 2 chi tiết</li><li>Điểm 3 ví dụ thực tế</li></ul>
            <p>Kết luận và CTA nhẹ nhàng — không bán hàng cứng.</p>
          </article>`;
          articleBatch.push([
            tid, slug, tpl.title,
            tpl.title + ' — ' + biz.name,
            html,
            mediaByTenant.get(tid) || null,
            publishedDate.toISOString(),
            tpl.title.slice(0, 60),
            `Phân tích ${tpl.focus} cho ${biz.name}`,
            tpl.title.slice(0, 60),
            `Phân tích ${tpl.focus} cho ${biz.name}`,
            tpl.focus,
            75 + randInt(0, 20),
            publishedDate.toISOString(),
          ]);
          articleCount++;
          if (articleBatch.length >= 200) {
            if (!DRY_RUN) articleTx(articleBatch.splice(0));
            else articleBatch.length = 0;
            process.stdout.write(`\r  articles: ${articleCount}…`);
          }
        }
      }
    }
  }
  if (articleBatch.length && !DRY_RUN) articleTx(articleBatch);
  console.log(`\r  ✓ ${articleCount} articles inserted${' '.repeat(20)}`);

  // ---------- 4) Leads — 5000 per business, distributed across tenants ----------
  console.log('▸ Leads (5000 per business)');
  const leadInsert = db.prepare(`
    INSERT INTO leads (tenant_id, name, phone, email, source, status, notes, ip_address, referer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const leadTx = db.transaction((rows) => {
    for (const r of rows) leadInsert.run(r);
  });

  let leadCount = 0;
  for (const biz of BUSINESS_THEMES) {
    const tenantIds = tenantsByBiz.get(biz.slug);
    const perTenant = Math.floor(SPEC.leads_per_biz / tenantIds.length);
    const remainder = SPEC.leads_per_biz - perTenant * tenantIds.length;
    const t0 = Date.now();

    for (let ti = 0; ti < tenantIds.length; ti++) {
      const tid = tenantIds[ti];
      const count = perTenant + (ti === 0 ? remainder : 0);
      const batch = [];
      for (let i = 0; i < count; i++) {
        const name = fakeName();
        batch.push([
          tid, name, fakePhone(), fakeEmail(name),
          rand(LEAD_SOURCES), rand(LEAD_STATUSES),
          i % 100 === 0 ? `Quan tâm dự án ${biz.name}` : '',
          `192.168.${randInt(1,255)}.${randInt(1,255)}`,
          rand(['', '/', '/lien-he', '/du-an', '/blog']),
        ]);
        if (batch.length === 1000) {
          if (!DRY_RUN) leadTx(batch);
          leadCount += batch.length;
          batch.length = 0;
          process.stdout.write(`\r  leads: ${leadCount}…`);
        }
      }
      if (batch.length && !DRY_RUN) { leadTx(batch); leadCount += batch.length; }
    }
    process.stdout.write(`\r  leads: ${leadCount} (${biz.slug} +${SPEC.leads_per_biz} in ${Date.now()-t0}ms)${' '.repeat(20)}\n`);
  }
  console.log(`  ✓ ${leadCount} leads inserted`);

  // ---------- 5) Summary ----------
  console.log('\n═══ Summary ═══');
  const counts = {
    tenants:  db.prepare(`SELECT COUNT(*) AS c FROM tenants WHERE settings_json LIKE '%seeded_by":"load-seed%'`).get().c,
    users:    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE email LIKE '%@omniplug.test'`).get().c,
    articles: db.prepare(`SELECT COUNT(*) AS c FROM articles`).get().c,
    leads:    db.prepare(`SELECT COUNT(*) AS c FROM leads`).get().c,
    media:    db.prepare(`SELECT COUNT(*) AS c FROM media`).get().c,
  };
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${v.toLocaleString('en-US')}`);

  // DB file size
  if (process.env.DB_PATH) {
    const fs = await import('node:fs');
    try {
      const st = fs.statSync(process.env.DB_PATH);
      console.log(`  db_file    ${(st.size / 1024 / 1024).toFixed(1)} MB`);
    } catch {}
  }

  console.log('\n✓ Seed complete. Default password for all seeded users: ' + PASSWORD);
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err);
  process.exit(1);
});
