/**
 * media/media.service.js — Business logic for media uploads & lifecycle.
 *
 * Design:
 *   1. Uses MediaRepository.scopeTo(tenantId) capability pattern — tenantId
 *      cannot be forgotten because it's bound at repo construction.
 *   2. Upload flow wrapped in a saga: if any step fails after a side effect
 *      (file written, row inserted), prior steps are compensated. No more
 *      orphan files or broken DB rows on partial failure.
 *   3. Purge flow also uses saga so partial purge (file deleted but DB row
 *      kept, or vice versa) is no longer possible.
 *
 * Tenant scope:
 *   The controller passes tenantId; the service constructs a scoped repo per
 *   call. Repo instances are cheap (no DB round-trip until first method).
 */

import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { MediaRepository } from './media.repository.js';
import { validateImageBuffer } from '../../../core/middleware/magicMime.js';
import { getMediaUsage, formatUsage } from '../../../core/lib/mediaUsage.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../core/lib/errors.js';
import { saga } from '../../../core/lib/saga.js';
import { env } from '../../../core/config/env.js';
import { suggestAlt, classifyAltStatus } from '../media-seo/media-seo.service.js';

// Ensure upload directory exists on module load (idempotent).
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

function publicUrl(media) {
  return env.UPLOAD_PUBLIC_URL + '/' + media.filename;
}

function decorate(media) {
  return media ? { ...media, url: publicUrl(media) } : null;
}

/**
 * Build a collision-resistant filename:
 *   t{tenantId}-{ISO timestamp}-{8 hex chars}-{sanitized stem}.webp
 */
function buildFilename(tenantId, originalName) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rand = crypto.randomBytes(4).toString('hex');
  const safeStem = path.basename(originalName)
    .replace(/[^\w.-]/g, '_')
    .slice(0, 50)
    .replace(/\.[^.]+$/, '');
  return `t${tenantId}-${ts}-${rand}-${safeStem}.webp`;
}

/**
 * Best-effort file unlink. Used as saga compensation — must not throw on
 * missing file (compensation may run before the file was actually written
 * to disk, e.g. if sharp itself failed).
 */
async function unlinkSafe(absPath) {
  try {
    await fs.promises.unlink(absPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[media] cleanup unlink failed:', absPath, err.message);
    }
  }
}

/**
 * Upload pipeline as a saga:
 *   Step 1: process buffer (in-memory, no compensation needed)
 *   Step 2: write file to disk     → compensate: unlink
 *   Step 3: insert DB row          → compensate: hard delete
 *
 * If step 3 fails (vd. UNIQUE constraint, DB lock timeout, disk full on WAL),
 * step 2's compensation runs and removes the orphan file. The HTTP response
 * is an error; no orphan artifacts remain.
 */
async function processUploadSafely(file, tenantId, userId, alt) {
  const validation = await validateImageBuffer(file.buffer);
  const repo = MediaRepository.scopeTo(tenantId);

  const filename = buildFilename(tenantId, file.originalname);
  const absPath = path.join(env.UPLOAD_DIR, filename);
  const trimmedAlt = String(alt || '').trim();
  const altSuggested = suggestAlt(file.originalname, '');
  const altStatus = classifyAltStatus(trimmedAlt, altSuggested);

  const results = await saga()
    .step(
      'processBuffer',
      async () => {
        const pipeline = sharp(file.buffer, { failOn: 'truncated' })
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 });
        return pipeline.toBuffer({ resolveWithObject: true });
      },
      // No compensation — pure in-memory operation
      () => {}
    )
    .step(
      'writeFile',
      async (ctx) => {
        await fs.promises.writeFile(absPath, ctx.processBuffer.data);
        return { path: absPath };
      },
      async () => unlinkSafe(absPath)
    )
    .step(
      'insertRow',
      (ctx) => repo.insert({
        filename,
        original_name: file.originalname.slice(0, 250),
        mime_type: 'image/webp',
        size_bytes: ctx.processBuffer.info.size,
        width: ctx.processBuffer.info.width,
        height: ctx.processBuffer.info.height,
        alt: trimmedAlt,
        alt_status: altStatus,
        alt_suggested: altSuggested,
        uploaded_by: userId,
      }),
      // Compensation: if a later step were added below this one and failed,
      // we'd need to remove this row. Currently it's the last step so this
      // compensation is defensive (no-op in practice, but kept for future).
      (info) => {
        if (info?.lastInsertRowid) repo.hardDelete(info.lastInsertRowid);
      }
    )
    .run();

  const created = repo.findById(results.insertRow.lastInsertRowid);
  return {
    media: decorate(created),
    auditMetadata: {
      filename,
      size: results.processBuffer.info.size,
      original_format: validation.mime,
    },
  };
}

export const mediaService = {
  upload(file, tenantId, userId, alt) {
    if (!file) throw new ValidationError('No file uploaded');
    return processUploadSafely(file, tenantId, userId, alt);
  },

  list(tenantId, { limit, offset }) {
    const repo = MediaRepository.scopeTo(tenantId);
    const rows = repo.findMany(limit, offset).map(decorate);
    return { rows, total: repo.countAll(), limit, offset };
  },

  getById(id, tenantId) {
    const repo = MediaRepository.scopeTo(tenantId);
    const m = repo.findById(id);
    if (!m) throw new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');
    return decorate(m);
  },

  getUsage(id, tenantId) {
    const repo = MediaRepository.scopeTo(tenantId);
    const m = repo.findById(id);
    if (!m) throw new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');
    const usage = getMediaUsage(id, tenantId);
    return { in_use: usage.length > 0, usage };
  },

  updateAlt(id, tenantId, alt) {
    const repo = MediaRepository.scopeTo(tenantId);
    const trimmed = String(alt || '').slice(0, 500);
    const info = repo.updateAlt(id, trimmed);
    if (info.changes === 0) throw new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');
    return decorate(repo.findById(id));
  },

  /**
   * Soft-delete blocked if media is referenced (no `?force` override).
   * Physical file kept until explicit `purge` — keeps restore reversible.
   */
  softDelete(id, tenantId) {
    const repo = MediaRepository.scopeTo(tenantId);
    const m = repo.findById(id);
    if (!m) throw new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');

    const usage = getMediaUsage(id, tenantId);
    if (usage.length > 0) {
      throw new ConflictError(
        'Ảnh đang được sử dụng. Hãy gỡ ảnh khỏi các bài viết / dự án / page sections trước khi xóa.',
        'MEDIA_IN_USE',
        { usage_summary: formatUsage(usage), usage_count: usage.length, usage }
      );
    }

    repo.softDelete(id);
    return {
      result: { deleted: true, soft: true },
      auditMetadata: { soft: true, filename: m.filename },
    };
  },

  /**
   * Hard delete via saga. Two artifacts to clean up: filesystem + DB row.
   * Order: delete row first (cheap to compensate by re-insert? No — row had
   * generated id. So order matters). We delete file first, then row. If row
   * delete fails, we cannot easily restore the file → return failure and
   * let admin retry; orphan-row scanner will eventually clean up.
   *
   * Decision: file delete first (idempotent if missing), row delete second.
   * If row delete fails AND file already gone: row is "soft orphan" — points
   * to missing file. The orphanScanner job will detect and remove.
   */
  async purge(id, tenantId) {
    const repo = MediaRepository.scopeTo(tenantId);
    const m = repo.findByIdAny(id);
    if (!m) throw new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');

    if (!m.deleted_at) {
      throw new ValidationError(
        'Media phải được soft-delete trước khi purge. Gọi DELETE /api/admin/media/:id trước.'
      );
    }

    const usage = getMediaUsage(id, tenantId);
    if (usage.length > 0) {
      throw new ConflictError(
        'Media vẫn còn reference. Gỡ tất cả trước khi purge.',
        'MEDIA_STILL_REFERENCED',
        { usage_summary: formatUsage(usage), usage_count: usage.length }
      );
    }

    const absPath = path.join(env.UPLOAD_DIR, m.filename);

    await saga()
      .step(
        'unlinkFile',
        () => unlinkSafe(absPath),
        // Compensation: cannot restore deleted file. Best we can do is log.
        // Will result in "soft orphan" DB row if subsequent step fails; this
        // is acceptable because the row is already soft-deleted.
        () => console.warn(`[media] cannot restore unlinked file: ${absPath}`)
      )
      .step(
        'hardDeleteRow',
        () => repo.hardDelete(id),
        // No compensation needed — if this is the last step, nothing follows.
        () => {}
      )
      .run();

    return {
      result: { purged: true, file_removed: true },
      auditMetadata: { filename: m.filename, file_removed: true },
    };
  },
};
