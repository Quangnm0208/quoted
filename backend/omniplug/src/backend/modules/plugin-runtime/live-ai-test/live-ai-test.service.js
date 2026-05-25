/**
 * live-ai-test service — quota check → Perplexity proxy → side-effect
 * (record cited URLs into the citations table so the dashboard reflects them).
 */

import db from '../../../../core/db/connection.js';
import { ask } from './perplexity.client.js';
import { usageRepo, firstOfNextMonthIso } from './usage.repository.js';
import { citationsRepo } from '../citations/citations.repository.js';

const FREE_MONTHLY  = Number(process.env.QUOTED_LIVE_AI_FREE_MONTHLY  || 3);
const PRO_MONTHLY   = Number(process.env.QUOTED_LIVE_AI_PRO_MONTHLY   || 100);
const AGENCY_MONTHLY = Number(process.env.QUOTED_LIVE_AI_AGENCY_MONTHLY || 250);

function err(code, message, httpStatus = 400, details = null) {
  const e = new Error(message); e.code = code; e.httpStatus = httpStatus; e.details = details; return e;
}

function limitForPlan(plan) {
  if (plan === 'agency') return AGENCY_MONTHLY;
  if (plan === 'pro')    return PRO_MONTHLY;
  return FREE_MONTHLY;
}

function getTenantDomain(tenantId) {
  const row = db.prepare(`SELECT domain FROM tenants WHERE id = ?`).get(tenantId);
  return row?.domain || null;
}

export function quotaFor({ tenantId, plan }) {
  const used  = usageRepo.currentUsed(tenantId);
  const limit = limitForPlan(plan);
  return {
    used_this_month: used,
    limit,
    remaining: Math.max(0, limit - used),
    resets_at: firstOfNextMonthIso(),
  };
}

export async function runQuery({ tenantId, plan, prompt }) {
  const used  = usageRepo.currentUsed(tenantId);
  const limit = limitForPlan(plan);
  if (used >= limit) {
    throw err(
      'QUOTA_EXCEEDED',
      `Monthly Live AI Test quota exhausted (${used}/${limit}).`,
      402,
      { used_this_month: used, limit, resets_at: firstOfNextMonthIso() },
    );
  }

  const tenantDomain = getTenantDomain(tenantId);
  const result = await ask(prompt, { tenantDomain });

  // Increment usage AFTER successful upstream call.
  usageRepo.bump(tenantId);

  // Side-effect: store the cited URLs we own into the citations table.
  for (const c of result.citations) {
    if (c.cited) {
      citationsRepo.upsert({
        tenantId,
        source: 'live_ai_test',
        query: prompt,
        citedUrl: c.url,
        responseExcerpt: result.answer.slice(0, 300),
        confidence: 0.95,  // Perplexity directly cited it
      });
    }
  }

  return {
    answer: result.answer,
    citations: result.citations,
    tokens_used: result.tokens_used,
    quota: quotaFor({ tenantId, plan }),
  };
}
