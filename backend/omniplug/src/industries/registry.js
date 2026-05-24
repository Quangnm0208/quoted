/**
 * industries/registry.js — Industry resolver.
 *
 * Reads the INDUSTRY env var and exports the active industry config. Other
 * core modules import `{ industry }` from this file — they do NOT know
 * which vertical they're running for. This is the boundary between the
 * generic core and the vertical skin.
 *
 * Failure modes:
 *   - INDUSTRY not set         → defaults to 'real-estate' (v1.2 behavior preserved)
 *   - INDUSTRY=unknown_value   → throws at startup (fail-fast, not runtime)
 *
 * Adding a new industry:
 *   1. Create src/industries/{name}.js exporting an object matching baseIndustry shape
 *   2. Add it to KNOWN map below
 *   3. Done. State machine, validators, future UI labels all read from registry.
 */

import { baseIndustry } from './_base.js';
import { realEstate }   from './real-estate.js';
import { spa }          from './spa.js';
import { branding }     from './branding.js';
import { professional } from './professional.js';
import { aesthetics }   from './aesthetics.js';

const KNOWN = Object.freeze({
  'base':         baseIndustry,
  'real-estate':  realEstate,
  'spa':          spa,
  'branding':     branding,
  'professional': professional,
  'aesthetics':   aesthetics,
});

const requested = (process.env.INDUSTRY || 'real-estate').trim().toLowerCase();

if (!KNOWN[requested]) {
  throw new Error(
    `Unknown INDUSTRY="${requested}". Available: ${Object.keys(KNOWN).join(', ')}. ` +
    `To add a new industry, create src/industries/{name}.js and register it in registry.js.`
  );
}

/** Active industry config — frozen, safe to share across modules. */
export const industry = KNOWN[requested];

/** For tests / debugging: list all available industries. */
export function listIndustries() {
  return Object.keys(KNOWN);
}
