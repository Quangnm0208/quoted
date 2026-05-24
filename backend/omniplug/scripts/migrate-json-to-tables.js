#!/usr/bin/env node
/**
 * scripts/migrate-json-to-tables.js
 *
 * Di chuyển dữ liệu cũ từ projects.timeline_json + projects.gallery_json
 * sang 2 tables mới project_milestones + project_gallery.
 *
 * Idempotent: skip projects đã được migrate (check sự tồn tại của
 * milestone/gallery rows).
 *
 * Run after `npm run migrate` has applied the core hardening migrations.
 *
 * Usage:
 *   node scripts/migrate-json-to-tables.js
 *   node scripts/migrate-json-to-tables.js --dry-run    # preview, không ghi
 *
 * Sau khi migrate xong + verify, có thể clear timeline_json/gallery_json
 * trong projects table (giữ nguyên là OK, không impact functionality).
 */

import db from '../src/core/db/connection.js';

const DRY_RUN = process.argv.includes('--dry-run');

function safeParseArray(s) {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function migrate() {
  console.log('▸ Migrating projects.timeline_json + gallery_json → tables');
  if (DRY_RUN) console.log('  (DRY RUN — no writes)');
  console.log('');

  const projects = db.prepare('SELECT id, slug, name, timeline_json, gallery_json FROM projects').all();
  if (!projects.length) {
    console.log('  No projects to migrate.');
    return;
  }

  const checkMilestonesEmpty = db.prepare('SELECT COUNT(*) AS c FROM project_milestones WHERE project_id = ?');
  const checkGalleryEmpty = db.prepare('SELECT COUNT(*) AS c FROM project_gallery WHERE project_id = ?');

  const insertMilestone = db.prepare(`
    INSERT INTO project_milestones
      (project_id, title, description, milestone_date, status, sort_order)
    VALUES (@project_id, @title, @description, @milestone_date, @status, @sort_order)
  `);
  const insertGalleryItem = db.prepare(`
    INSERT INTO project_gallery
      (project_id, media_id, caption, sort_order)
    VALUES (@project_id, @media_id, @caption, @sort_order)
  `);
  const checkMediaExists = db.prepare('SELECT 1 FROM media WHERE id = ?');

  let totalMilestones = 0, totalGalleryItems = 0, skippedProjects = 0, skippedMedia = 0;

  for (const p of projects) {
    const mCount = checkMilestonesEmpty.get(p.id).c;
    const gCount = checkGalleryEmpty.get(p.id).c;

    if (mCount > 0 && gCount > 0) {
      console.log(`  ⊙ Project #${p.id} "${p.name}" — already migrated, skip`);
      skippedProjects++;
      continue;
    }

    const timeline = safeParseArray(p.timeline_json);
    const gallery  = safeParseArray(p.gallery_json);

    console.log(`  → Project #${p.id} "${p.name}"`);
    console.log(`    Milestones: ${timeline.length}, Gallery items: ${gallery.length}`);

    // Migrate milestones
    if (mCount === 0 && timeline.length) {
      const tx = db.transaction(() => {
        timeline.forEach((m, idx) => {
          insertMilestone.run({
            project_id: p.id,
            title: String(m.title || '').slice(0, 200) || 'Untitled milestone',
            description: String(m.description || '').slice(0, 1000),
            milestone_date: String(m.date || '').slice(0, 50) || null,
            status: m.done ? 'done' : 'pending',
            sort_order: idx * 10,
          });
        });
      });
      if (!DRY_RUN) tx();
      totalMilestones += timeline.length;
    }

    // Migrate gallery — skip items có media_id không tồn tại
    if (gCount === 0 && gallery.length) {
      const tx = db.transaction(() => {
        gallery.forEach((g, idx) => {
          const mediaId = parseInt(g.media_id, 10);
          if (Number.isNaN(mediaId)) { skippedMedia++; return; }
          if (!checkMediaExists.get(mediaId)) {
            console.log(`    ⚠ media_id ${mediaId} not found, skip`);
            skippedMedia++;
            return;
          }
          insertGalleryItem.run({
            project_id: p.id,
            media_id: mediaId,
            caption: String(g.caption || '').slice(0, 500),
            sort_order: idx * 10,
          });
        });
      });
      if (!DRY_RUN) tx();
      totalGalleryItems += gallery.length;
    }
  }

  console.log('');
  console.log('▸ Done.');
  console.log(`  Projects migrated:     ${projects.length - skippedProjects}`);
  console.log(`  Projects skipped:      ${skippedProjects}`);
  console.log(`  Milestones inserted:   ${totalMilestones}`);
  console.log(`  Gallery items inserted: ${totalGalleryItems}`);
  if (skippedMedia) console.log(`  Gallery items skipped (bad media_id): ${skippedMedia}`);
  if (DRY_RUN) console.log('');
  if (DRY_RUN) console.log('  This was a DRY RUN. Run without --dry-run to apply.');
}

try {
  migrate();
} catch (err) {
  console.error('✗ Migration failed:', err);
  process.exit(1);
}
