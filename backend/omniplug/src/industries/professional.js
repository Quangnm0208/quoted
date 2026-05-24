/**
 * industries/professional.js — Professional services.
 *
 * Covers: interior design, business consulting, legal advisory, architecture.
 * All share a "client engagement" lifecycle:
 *   brief received → in execution → delivered to client → archived.
 *
 * Why merged: these 3 industries have functionally identical lifecycle. The
 * only difference is labels (Hợp đồng / Dự án thiết kế / Tư vấn vụ việc),
 * which are presentation-layer concerns handled by tenant config later.
 *
 * If one of these industries grows distinct workflow needs (vd. legal needs
 * "court date" milestone), split into its own file then.
 */

import { baseIndustry } from './_base.js';

export const professional = Object.freeze({
  ...baseIndustry,
  name: 'professional',
  labels: {
    singular: 'Dự án',
    plural: 'Dự án',
    create: 'Thêm dự án',
    statusField: 'Tình trạng',
  },
  statusEnum: ['brief', 'in_progress', 'review', 'delivered', 'archived', 'on_hold'],
  statusTransitions: {
    brief:       ['in_progress', 'on_hold'],
    in_progress: ['review', 'on_hold'],
    review:      ['delivered', 'in_progress', 'on_hold'],
    delivered:   ['archived'],
    archived:    [],
    on_hold:     ['brief', 'in_progress', 'review'],
  },
  statusDefault: 'brief',
});
