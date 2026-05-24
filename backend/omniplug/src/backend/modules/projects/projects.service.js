/**
 * projects/projects.service.js — Business logic (tenant-aware).
 *
 * Receives tenantId from the controller; never touches req/res. Orchestrates
 * the projects repository + the milestones/gallery sub-resource repositories.
 *
 * Public API:
 *   list(tenantId, { limit, offset }, uploadBaseUrl)
 *   getBySlug(tenantId, slug, uploadBaseUrl)
 *   getById(tenantId, id, uploadBaseUrl)
 *   create(tenantId, input, uploadBaseUrl)
 *   update(tenantId, id, input, uploadBaseUrl)
 *   softDelete(tenantId, id)
 *   restore(tenantId, id)
 *   listMilestones / listGallery — pass-through with project-exists guard
 */

import { projectsRepository } from './projects.repository.js';
import { milestonesRepository } from './milestones.repository.js';
import { galleryRepository } from './gallery.repository.js';
import { assertTransition } from './projects.stateMachine.js';
import { NotFoundError, ValidationError } from '../../../core/lib/errors.js';
import { slugify, ensureUniqueSlug } from '../../../core/lib/slug.js';

/**
 * Convert a DB row into the response shape. Optionally hydrates nested
 * milestones + gallery (skipped for list views, included for single fetch).
 */
function decorate(project, tenantId, uploadBaseUrl, includeNested = true) {
  if (!project) return null;

  const out = {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    status: project.status,
    progress_pct: project.progress_pct,
    cover_media_id: project.cover_media_id,
    cover_url: null,
    is_featured: !!project.is_featured,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };

  if (project.cover_media_id) {
    const media = projectsRepository.findMediaFilename(project.cover_media_id, tenantId);
    if (media) out.cover_url = uploadBaseUrl + '/' + media.filename;
  }

  if (includeNested) {
    out.milestones = milestonesRepository.listByProject(project.id, tenantId, uploadBaseUrl);
    out.gallery = galleryRepository.listByProject(project.id, tenantId, uploadBaseUrl);
  }

  return out;
}

/**
 * Map the legacy `timeline` array shape into the milestones table shape.
 * Kept for backward compatibility with legacy clients that still send `timeline`.
 */
function mapTimelineToMilestones(timeline) {
  return timeline.map((item, idx) => ({
    title: item.title || 'Untitled',
    description: item.description || '',
    milestone_date: item.date || null,
    status: item.done ? 'done' : 'pending',
    sort_order: idx * 10,
  }));
}

/**
 * Apply create/update side-effects on milestone + gallery sub-resources.
 * `timeline` (legacy compat) is mapped onto milestones. Explicit `milestones`
 * takes precedence if both are supplied.
 */
function applyNestedReplacements(projectId, tenantId, input, uploadBaseUrl) {
  if (input.timeline?.length) {
    milestonesRepository.replaceAll(
      projectId, tenantId, mapTimelineToMilestones(input.timeline), uploadBaseUrl
    );
  }
  if (input.milestones) {
    milestonesRepository.replaceAll(projectId, tenantId, input.milestones, uploadBaseUrl);
  }
  if (input.gallery) {
    galleryRepository.replaceAll(projectId, tenantId, input.gallery, uploadBaseUrl);
  }
}

export const projectsService = {
  list(tenantId, { limit, offset }, uploadBaseUrl) {
    const rows = projectsRepository.findMany(tenantId, limit, offset)
      .map(p => decorate(p, tenantId, uploadBaseUrl, false));
    return { rows, total: projectsRepository.countAll(tenantId), limit, offset };
  },

  getBySlug(tenantId, slug, uploadBaseUrl) {
    const project = projectsRepository.findBySlug(slug, tenantId);
    if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    return decorate(project, tenantId, uploadBaseUrl, true);
  },

  getById(tenantId, id, uploadBaseUrl) {
    const project = projectsRepository.findById(id, tenantId);
    if (!project) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    return decorate(project, tenantId, uploadBaseUrl, true);
  },

  listMilestones(tenantId, projectId, uploadBaseUrl) {
    if (!projectsRepository.findById(projectId, tenantId)) {
      throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    }
    return milestonesRepository.listByProject(projectId, tenantId, uploadBaseUrl);
  },

  listGallery(tenantId, projectId, uploadBaseUrl) {
    if (!projectsRepository.findById(projectId, tenantId)) {
      throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    }
    return galleryRepository.listByProject(projectId, tenantId, uploadBaseUrl);
  },

  create(tenantId, input, uploadBaseUrl) {
    if (!input.name) throw new ValidationError('Name required');

    const baseSlug = input.slug ? slugify(input.slug) : slugify(input.name);
    const slug = ensureUniqueSlug(
      baseSlug,
      (candidate) => projectsRepository.slugExists(candidate, tenantId)
    );

    const info = projectsRepository.insert({
      tenant_id: tenantId,
      slug,
      name: input.name.trim(),
      description: input.description || '',
      status: input.status || 'planning',
      progress_pct: input.progress_pct ?? 0,
      cover_media_id: input.cover_media_id || null,
      is_featured: input.is_featured ? 1 : 0,
    });
    const id = info.lastInsertRowid;

    applyNestedReplacements(id, tenantId, input, uploadBaseUrl);

    return decorate(projectsRepository.findById(id, tenantId), tenantId, uploadBaseUrl, true);
  },

  update(tenantId, id, input, uploadBaseUrl) {
    const existing = projectsRepository.findById(id, tenantId);
    if (!existing) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');

    let newSlug = existing.slug;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      const base = slugify(input.slug || input.name || existing.name);
      newSlug = ensureUniqueSlug(
        base,
        (candidate) => candidate !== existing.slug && projectsRepository.slugExists(candidate, tenantId)
      );
    }

    // State machine guard: prevent nonsensical status transitions
    // (e.g. completed → planning). assertTransition is a no-op if status
    // is unchanged or not supplied.
    if (input.status !== undefined && input.status !== existing.status) {
      assertTransition(existing.status, input.status);
    }

    projectsRepository.update({
      id,
      tenant_id: tenantId,
      slug: newSlug,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      progress_pct: input.progress_pct ?? existing.progress_pct,
      cover_media_id: input.cover_media_id !== undefined
        ? input.cover_media_id
        : existing.cover_media_id,
      is_featured: input.is_featured !== undefined
        ? (input.is_featured ? 1 : 0)
        : existing.is_featured,
    });

    applyNestedReplacements(id, tenantId, input, uploadBaseUrl);

    return decorate(projectsRepository.findById(id, tenantId), tenantId, uploadBaseUrl, true);
  },

  softDelete(tenantId, id) {
    const info = projectsRepository.softDelete(id, tenantId);
    if (info.changes === 0) throw new NotFoundError('Project not found', 'PROJECT_NOT_FOUND');
    return { deleted: true, soft: true };
  },

  restore(tenantId, id) {
    const info = projectsRepository.restore(id, tenantId);
    if (info.changes === 0) throw new NotFoundError('Project not deleted', 'NOT_DELETED');
    return { restored: true };
  },

  // Milestone sub-resource (CRUD operations the controller delegates here so
  // it doesn't import milestonesRepository directly).
  createMilestone(tenantId, projectId, input, uploadBaseUrl) {
    if (!projectsRepository.findById(projectId, tenantId)) {
      throw new NotFoundError('Project not found');
    }
    return milestonesRepository.create(projectId, tenantId, input, uploadBaseUrl);
  },

  updateMilestone(tenantId, milestoneId, input, uploadBaseUrl) {
    const updated = milestonesRepository.update(milestoneId, tenantId, input, uploadBaseUrl);
    if (!updated) throw new NotFoundError('Milestone not found');
    return updated;
  },

  deleteMilestone(tenantId, milestoneId) {
    if (!milestonesRepository.delete(milestoneId, tenantId)) {
      throw new NotFoundError('Milestone not found');
    }
    return { deleted: true };
  },

  // Gallery sub-resource
  createGalleryItem(tenantId, projectId, input, uploadBaseUrl) {
    if (!projectsRepository.findById(projectId, tenantId)) {
      throw new NotFoundError('Project not found');
    }
    try {
      return galleryRepository.create(projectId, tenantId, input, uploadBaseUrl);
    } catch (err) {
      // Repository throws when media_id is invalid / not in tenant. Reframe
      // as a 400 ValidationError for the HTTP boundary.
      throw new ValidationError(err.message);
    }
  },

  deleteGalleryItem(tenantId, itemId) {
    if (!galleryRepository.delete(itemId, tenantId)) {
      throw new NotFoundError('Gallery item not found');
    }
    return { deleted: true };
  },
};
