/**
 * live_test_usage repository — per-tenant monthly quota counter.
 * Schema in migration 037.
 */

import db from '../../../../core/db/connection.js';
import { lazyPrepare } from '../../../../core/db/lazyPrepare.js';

const stmt = lazyPrepare(() => ({
  // Insert-or-fetch the row for (tenant, current month).
  upsert: db.prepare(`
    INSERT INTO live_test_usage (tenant_id, year_month, used_count, last_used_at)
    VALUES (@tenant_id, @ym, 0, NULL)
    ON CONFLICT(tenant_id, year_month) DO NOTHING
  `),
  find: db.prepare(`
    SELECT used_count, last_used_at FROM live_test_usage
    WHERE tenant_id = ? AND year_month = ?
  `),
  increment: db.prepare(`
    UPDATE live_test_usage
    SET used_count = used_count + 1,
        last_used_at = datetime('now'),
        updated_at   = datetime('now')
    WHERE tenant_id = ? AND year_month = ?
  `),
}));

export function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function firstOfNextMonthIso() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export const usageRepo = {
  currentUsed(tenantId) {
    const ym = currentMonth();
    stmt().upsert.run({ tenant_id: tenantId, ym });
    const row = stmt().find.get(tenantId, ym);
    return row?.used_count || 0;
  },

  bump(tenantId) {
    const ym = currentMonth();
    stmt().upsert.run({ tenant_id: tenantId, ym });
    stmt().increment.run(tenantId, ym);
  },
};
