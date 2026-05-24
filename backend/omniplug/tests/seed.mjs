import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const db = new DatabaseSync('/tmp/loadtest/load.db');
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

console.log('=== Seeding ===');
const t0 = Date.now();

db.exec(`
  DELETE FROM leads;
  DELETE FROM articles;
  DELETE FROM projects;
  DELETE FROM media;
  DELETE FROM redirections;
  DELETE FROM error_404_log;
  DELETE FROM indexing_log;
  DELETE FROM audit_log;
  DELETE FROM tenants WHERE id > 1;
`);

const industries = ['real-estate', 'spa', 'clinic', 'professional', 'branding', 'spa'];
const statuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const sources = ['landing', 'facebook-ad', 'google-ad', 'zalo', 'organic', 'referral', 'tiktok'];
const firstNames = ['Nguyễn Văn', 'Trần Thị', 'Phạm Đức', 'Lê Minh', 'Hoàng Thu', 'Vũ Quốc', 'Đặng Bích', 'Bùi Văn', 'Đỗ Thị', 'Hồ Quang'];
const lastNames = ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Phong', 'Giang', 'Hà', 'Khánh', 'Linh', 'Minh', 'Nam', 'Oanh', 'Phương', 'Quang'];

const rnd = (n) => Math.floor(Math.random() * n);
const rndChoice = (arr) => arr[rnd(arr.length)];

const insertTenant = db.prepare(`
  INSERT INTO tenants (slug, name, domain, status, settings_json)
  VALUES (?, ?, ?, 'active', json_object('industry', ?, 'plan', 'pro'))
`);
const tenantIds = [];
for (let i = 1; i <= 30; i++) {
  const r = insertTenant.run(`tenant-${i}`, `Doanh nghiệp ${i}`, `tenant${i}.local`, rndChoice(industries));
  tenantIds.push(Number(r.lastInsertRowid));
}
console.log(`✓ Created ${tenantIds.length} tenants (IDs: ${tenantIds[0]}..${tenantIds[tenantIds.length-1]})`);

const insertLead = db.prepare(`
  INSERT INTO leads (tenant_id, name, phone, email, source, status, notes, user_agent, ip_address, referer, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), datetime('now', '-' || ? || ' hours'))
`);
const insertLeadTx = (leads) => { db.exec("BEGIN"); for (const ld of leads) insertLead.run(...ld); db.exec("COMMIT"); };

let totalLeads = 0;
const tenantLeadCount = {};
for (const tid of tenantIds) {
  const count = 1000 + rnd(4001);
  tenantLeadCount[tid] = count;
  const leads = [];
  for (let i = 0; i < count; i++) {
    const fn = rndChoice(firstNames);
    const ln = rndChoice(lastNames);
    const hoursAgo = rnd(24 * 365);
    leads.push([
      tid, `${fn} ${ln} ${rnd(99)}`,
      `0${9}${String(rnd(99999999)).padStart(8, '0')}`,
      `${ln.toLowerCase().replace(/\s/g,'')}${rnd(999)}@gmail.com`,
      rndChoice(sources), rndChoice(statuses), '',
      'Mozilla/5.0', `192.168.${rnd(256)}.${rnd(256)}`, 'https://google.com',
      hoursAgo, hoursAgo,
    ]);
  }
  insertLeadTx(leads);
  totalLeads += count;
}
console.log(`✓ Inserted ${totalLeads.toLocaleString()} leads`);

const insertArticle = db.prepare(`
  INSERT INTO articles (tenant_id, slug, title, excerpt, content_html, status, focus_keyword, seo_title, seo_description, created_at, updated_at, published_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
`);
let artCount = 0;
for (const tid of tenantIds) {
  const n = 5 + rnd(20);
  for (let i = 0; i < n; i++) {
    insertArticle.run(
      tid, `article-${tid}-${i}-${rnd(99999)}`,
      `Bài viết ${i} của tenant ${tid}`, 'Excerpt here',
      '<h2>Tổng quan</h2><p>Nội dung bài viết với <a href="/articles/x">internal link</a></p><img src="/x.webp" data-media-id="1">',
      i % 3 === 0 ? 'published' : 'draft',
      'từ khoá', `SEO title for article ${i}`, 'SEO description here',
    );
    artCount++;
  }
}
console.log(`✓ Inserted ${artCount} articles`);

const insert404 = db.prepare(`
  INSERT INTO error_404_log (tenant_id, uri, hits, last_referer, last_user_agent, is_ignored, first_seen_at, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 month'), datetime('now', '-' || ? || ' hours'))
`);
const insert404Tx = (rows) => { db.exec("BEGIN"); for (const r of rows) insert404.run(...r); db.exec("COMMIT"); };
let err404Count = 0;
for (const tid of tenantIds) {
  const rows = [];
  const n = 50 + rnd(100);
  for (let i = 0; i < n; i++) {
    rows.push([
      tid, `/lost-page-${rnd(10000)}-${rnd(99999)}`, 1 + rnd(500),
      rnd(2) === 0 ? 'https://google.com' : null,
      'Mozilla/5.0 Chrome',
      rnd(10) === 0 ? 1 : 0,
      rnd(720),
    ]);
  }
  insert404Tx(rows);
  err404Count += n;
}
console.log(`✓ Inserted ${err404Count} 404 entries`);

const insertRedirect = db.prepare(`
  INSERT INTO redirections (tenant_id, source_url, match_type, destination_url, status_code, is_active, hits, auto_created, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))
`);
let redirCount = 0;
for (const tid of tenantIds) {
  const n = 5 + rnd(20);
  for (let i = 0; i < n; i++) {
    const matchType = ['exact', 'exact', 'exact', 'starts_with', 'regex'][rnd(5)];
    const src = matchType === 'regex' ? `^/old-${tid}-${i}/(.+)$`
              : matchType === 'starts_with' ? `/legacy-${i}/`
              : `/old-page-${tid}-${i}`;
    try {
      insertRedirect.run(tid, src, matchType, `/new-page-${tid}-${i}`, [301, 301, 302, 410][rnd(4)], rnd(1000), rnd(2));
      redirCount++;
    } catch (e) { /* unique constraint */ }
  }
}
console.log(`✓ Inserted ${redirCount} redirections`);

const insertIdx = db.prepare(`
  INSERT INTO indexing_log (tenant_id, url, provider, status_code, status, is_manual, submitted_at)
  VALUES (?, ?, 'indexnow', ?, ?, ?, datetime('now', '-' || ? || ' hours'))
`);
const insertIdxTx = (rows) => { db.exec("BEGIN"); for (const r of rows) insertIdx.run(...r); db.exec("COMMIT"); };
let idxCount = 0;
for (const tid of tenantIds) {
  const rows = [];
  const n = 100 + rnd(500);
  for (let i = 0; i < n; i++) {
    rows.push([
      tid, `https://tenant${tid}.local/articles/post-${i}`,
      [200, 200, 200, 429, 502][rnd(5)],
      ['success', 'success', 'success', 'throttled', 'failed'][rnd(5)],
      rnd(10) === 0 ? 1 : 0,
      rnd(2160),
    ]);
  }
  insertIdxTx(rows);
  idxCount += n;
}
console.log(`✓ Inserted ${idxCount} indexing log entries`);

console.log(`\nSeed completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('\n=== Row counts ===');
for (const t of ['tenants', 'leads', 'articles', 'error_404_log', 'redirections', 'indexing_log']) {
  const r = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
  console.log(`  ${t}: ${r.c.toLocaleString()}`);
}
const stats = fs.statSync('/tmp/loadtest/load.db');
console.log(`\nDB file size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

// Save tenantLeadCount for tests
fs.writeFileSync('/tmp/loadtest/tenant-counts.json', JSON.stringify({ tenantIds, tenantLeadCount, totalLeads }));
db.close();
