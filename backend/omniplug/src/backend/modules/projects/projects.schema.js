/**
 * projects/projects.schema.js — Zod validation schemas.
 *
 * Previously inline in projects.controller.js. Extracted so that the controller
 * stays focused on HTTP routing and the schemas can be reused by tests.
 */

import { z } from 'zod';

export const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  milestone_date: z.string().max(50).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'delayed']).optional(),
  sort_order: z.number().int().optional(),
  cover_media_id: z.number().int().positive().nullable().optional(),
});

export const galleryItemSchema = z.object({
  media_id: z.number().int().positive(),
  caption: z.string().max(500).optional(),
  sort_order: z.number().int().optional(),
});

export const projectInputSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  slug: z.string().max(80).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum([
    'planning', 'foundation', 'construction', 'finishing',
    'handover', 'completed', 'on_hold',
  ]).optional(),
  progress_pct: z.number().int().min(0).max(100).optional(),
  cover_media_id: z.number().int().positive().nullable().optional(),
  is_featured: z.boolean().optional(),
  milestones: z.array(milestoneSchema).max(50).optional(),
  gallery: z.array(galleryItemSchema).max(100).optional(),

  // legacy backward-compat: clients still send `timeline` array; service maps it
  // into the milestones table. New code should send `milestones` instead.
  timeline: z.array(z.object({
    date: z.string().max(50).optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    done: z.boolean().optional(),
  })).max(50).optional(),
});

export const projectIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const projectSlugParamSchema = z.object({
  slug: z.string().min(1).max(80),
});
