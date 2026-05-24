/**
 * industries/spa.js — Spa, beauty, treatment packages.
 *
 * Showcase entity = service packages (gói liệu trình). Lifecycle is simple:
 * a package is being prepared, live for booking, or retired.
 *
 * Note: per-booking lifecycle (pending/confirmed/in_progress/done) lives in
 * a separate `orders` module (not built yet). That's a TRANSACTION lifecycle,
 * not a SHOWCASE lifecycle, so it doesn't belong on the showcase entity.
 */

import { baseIndustry } from './_base.js';

export const spa = Object.freeze({
  ...baseIndustry,
  name: 'spa',
  labels: {
    singular: 'Liệu trình',
    plural: 'Liệu trình',
    create: 'Thêm liệu trình',
    statusField: 'Tình trạng',
  },
  statusEnum: ['draft', 'active', 'paused', 'retired'],
  statusTransitions: {
    draft:    ['active'],
    active:   ['paused', 'retired'],
    paused:   ['active', 'retired'],
    retired:  [],
  },
  statusDefault: 'draft',
});
