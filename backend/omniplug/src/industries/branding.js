/**
 * industries/branding.js — Branding agency case studies.
 *
 * Showcase entity = case studies. Lifecycle: project-in-progress for clients,
 * then published as portfolio piece (with NDA consideration).
 */

import { baseIndustry } from './_base.js';

export const branding = Object.freeze({
  ...baseIndustry,
  name: 'branding',
  labels: {
    singular: 'Case study',
    plural: 'Case studies',
    create: 'Thêm case study',
    statusField: 'Tình trạng',
  },
  statusEnum: ['in_progress', 'completed', 'published', 'archived'],
  statusTransitions: {
    in_progress: ['completed', 'archived'],
    completed:   ['published', 'archived'],
    published:   ['archived'],
    archived:    [],
  },
  statusDefault: 'in_progress',
});
