/**
 * industries/real-estate.js — BĐS/xây dựng (mirror v1.2 behavior).
 *
 * IMPORTANT: This config MUST preserve the exact status enum + transitions
 * that v1.2 has hardcoded. Switching INDUSTRY=real-estate (or leaving it
 * unset, since this is the default) MUST behave identically to v1.2.
 *
 * If you change anything here, run the smoke test in projects.stateMachine
 * to confirm BĐS regression suite still passes.
 */

import { baseIndustry } from './_base.js';

export const realEstate = Object.freeze({
  ...baseIndustry,
  name: 'real-estate',
  labels: {
    singular: 'Dự án',
    plural: 'Dự án',
    create: 'Thêm dự án',
    statusField: 'Trạng thái thi công',
  },
  // EXACT match v1.2 hardcoded values — do not modify without migration.
  statusEnum: [
    'planning', 'foundation', 'construction', 'finishing',
    'handover', 'completed', 'on_hold',
  ],
  statusTransitions: {
    planning:     ['foundation', 'on_hold'],
    foundation:   ['construction', 'on_hold'],
    construction: ['finishing', 'on_hold'],
    finishing:    ['handover', 'on_hold'],
    handover:     ['completed', 'on_hold'],
    completed:    [],
    on_hold:      ['planning', 'foundation', 'construction', 'finishing', 'handover'],
  },
  statusDefault: 'planning',
});
