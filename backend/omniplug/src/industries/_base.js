/**
 * industries/_base.js — Generic industry config (fallback).
 *
 * Architecture role:
 *   This is the "vertical skin" layer. It is purely additive — core code in
 *   src/core/ and src/backend/modules/ does NOT change between industries.
 *   What changes:
 *     - Status enum + transitions on the showcase entity (`projects` table)
 *     - User-facing labels (admin UI calls these via i18n helper)
 *     - Default page sections / seed content (future)
 *
 * Why a `_base`:
 *   Every industry config can spread ...base. If we add a new field later
 *   (vd. defaultMediaCount), industries that don't override get the default
 *   automatically. No more "config A has 5 fields, config B has 4" drift.
 *
 * Contract (every industry file MUST export the same shape):
 *   {
 *     name:               string         — slug, matches INDUSTRY env value
 *     primaryEntity:      string         — table name (currently always 'projects')
 *     labels:             {              — i18n keys, used by admin UI later
 *       singular: string,
 *       plural:   string,
 *       create:   string,
 *       statusField: string,
 *     },
 *     statusEnum:         string[]       — allowed status values
 *     statusTransitions:  Record<string, string[]>  — from → allowed to[]
 *     statusDefault:      string         — initial status on create
 *   }
 */

export const baseIndustry = Object.freeze({
  name: 'base',
  primaryEntity: 'projects',
  labels: {
    singular: 'Mục',
    plural: 'Danh mục',
    create: 'Thêm mục',
    statusField: 'Trạng thái',
  },
  // Minimal generic lifecycle: draft → published → archived. Nothing industry
  // -specific. Industries with richer lifecycles override this entirely.
  statusEnum: ['draft', 'published', 'archived'],
  statusTransitions: {
    draft:     ['published', 'archived'],
    published: ['archived', 'draft'],
    archived:  ['draft'],
  },
  statusDefault: 'draft',
});
