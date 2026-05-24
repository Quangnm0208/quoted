/**
 * industries/aesthetics.js — Aesthetic surgery / cosmetic procedures.
 *
 * Showcase entity = procedures/services offered. Similar to spa but with
 * additional 'consultation_required' state because aesthetic procedures
 * generally cannot be booked without a prior consultation.
 *
 * Note: per-patient case histories (sensitive medical data) MUST NOT live
 * here — they need a separate, audit-restricted module. This config only
 * covers the public-facing showcase of available procedures.
 */

import { baseIndustry } from './_base.js';

export const aesthetics = Object.freeze({
  ...baseIndustry,
  name: 'aesthetics',
  labels: {
    singular: 'Dịch vụ',
    plural: 'Dịch vụ',
    create: 'Thêm dịch vụ',
    statusField: 'Tình trạng',
  },
  statusEnum: ['draft', 'consultation_only', 'open_for_booking', 'paused', 'retired'],
  statusTransitions: {
    draft:               ['consultation_only', 'open_for_booking'],
    consultation_only:   ['open_for_booking', 'paused', 'retired'],
    open_for_booking:    ['consultation_only', 'paused', 'retired'],
    paused:              ['consultation_only', 'open_for_booking', 'retired'],
    retired:             [],
  },
  statusDefault: 'draft',
});
