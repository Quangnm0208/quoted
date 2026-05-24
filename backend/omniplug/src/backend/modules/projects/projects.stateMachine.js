/**
 * projects/projects.stateMachine.js — Explicit lifecycle transitions.
 *
 * Status transitions are now sourced from the active industry config
 * (src/industries/registry.js) rather than hardcoded here. The exported
 * functions (`assertTransition`, `allowedNextStatuses`) preserve the
 * v1.2 public API exactly — only the internal source changed.
 *
 * Default behavior (INDUSTRY unset or =real-estate) matches v1.2 hardcoded
 * BĐS transitions byte-for-byte. Verified by sanity test.
 *
 * Adding a new status for a vertical:
 *   1. Edit src/industries/{name}.js — add to statusEnum + statusTransitions
 *   2. If new value not previously in DB CHECK constraint, run a migration
 *      to expand the constraint (or remove it — see migration 010).
 *   3. No change needed in this file.
 */

import { ValidationError } from '../../../core/lib/errors.js';
import { industry } from '../../../industries/registry.js';

/**
 * Re-exported for backward compat and for callers that want to introspect
 * the transition map (vd. building admin dropdowns from JS).
 */
export const projectTransitions = industry.statusTransitions;

const ALL_STATUSES = Object.freeze(industry.statusEnum);

/**
 * Throws ValidationError if `from → to` is not allowed for the active
 * industry. No-op if `from === to` (idempotent updates).
 */
export function assertTransition(from, to) {
  if (from === to) return;

  if (!ALL_STATUSES.includes(to)) {
    throw new ValidationError(
      `Invalid status "${to}" for industry "${industry.name}". ` +
      `Allowed: ${ALL_STATUSES.join(', ')}`,
      'INVALID_STATUS'
    );
  }

  const allowed = projectTransitions[from] || [];
  if (!allowed.includes(to)) {
    throw new ValidationError(
      `Cannot transition status from "${from}" to "${to}". ` +
      (allowed.length === 0
        ? `"${from}" is a terminal state.`
        : `Allowed next states from "${from}": ${allowed.join(', ')}.`),
      'INVALID_TRANSITION'
    );
  }
}

/** Used by the admin UI to show only valid options in a dropdown. */
export function allowedNextStatuses(from) {
  return [...(projectTransitions[from] || [])];
}
