/**
 * core/lib/saga.js — Compensating transaction helper.
 *
 * Problem this solves:
 *   better-sqlite3's db.transaction() does NOT support async operations.
 *   But media upload mixes async (sharp resize) with sync (db insert) with
 *   side-effects on disk (fs.writeFileSync). When step N+1 fails, the
 *   side-effects of step 1..N must be undone, or we leak orphan files /
 *   broken DB references.
 *
 * Pattern:
 *   1. Each step pairs a `do` with a `compensate`.
 *   2. Steps execute in order.
 *   3. On any failure, executed steps' compensations run in REVERSE order.
 *   4. Compensations MUST be idempotent and tolerate missing artifacts
 *      (file already gone, row already deleted) — they are best-effort cleanup.
 *
 * Example (media upload):
 *   const result = await saga()
 *     .step('writeFile',
 *           async () => fs.promises.writeFile(path, buffer),
 *           async () => fs.promises.unlink(path).catch(() => {}))
 *     .step('insertRow',
 *           () => mediaRepo.insert({...}),
 *           (insertInfo) => mediaRepo.hardDelete(insertInfo.lastInsertRowid))
 *     .run();
 *
 * Notes:
 *   - Compensations receive the result of the corresponding `do`.
 *   - Compensation errors are LOGGED, not thrown — saga itself still
 *     re-throws the ORIGINAL error so caller knows what failed.
 *   - This is NOT a distributed-systems saga (no event log, no replay).
 *     It is an in-process best-effort cleanup pattern.
 */

export function saga() {
  const steps = [];

  return {
    step(name, doFn, compensateFn) {
      if (typeof name !== 'string') {
        throw new Error('saga.step: name (string) is required');
      }
      if (typeof doFn !== 'function') {
        throw new Error(`saga.step("${name}"): doFn is required`);
      }
      if (typeof compensateFn !== 'function') {
        throw new Error(
          `saga.step("${name}"): compensateFn is required. ` +
          `If this step truly has no side-effect, pass () => {} explicitly.`
        );
      }
      steps.push({ name, doFn, compensateFn });
      return this;
    },

    /**
     * Execute steps in order. Returns an object mapping step names to their
     * `do` results, e.g. `{ writeFile: undefined, insertRow: { lastInsertRowid: 42 } }`.
     * On failure, executed steps are compensated in reverse and the original
     * error is re-thrown.
     */
    async run() {
      const results = {};
      const executed = [];

      for (const step of steps) {
        try {
          // Support both sync and async `do` functions.
          const result = await Promise.resolve(step.doFn(results));
          results[step.name] = result;
          executed.push(step);
        } catch (originalErr) {
          // Run compensations in REVERSE order. Don't let compensation errors
          // mask the original failure — log and continue.
          for (let i = executed.length - 1; i >= 0; i--) {
            const done = executed[i];
            try {
              await Promise.resolve(done.compensateFn(results[done.name]));
            } catch (compErr) {
              console.warn(
                `[saga] compensation for step "${done.name}" failed: ${compErr.message}. ` +
                `Manual cleanup may be required. Original error: ${originalErr.message}`
              );
            }
          }
          // Annotate the error with which step failed so caller can log it usefully.
          originalErr.failedStep = step.name;
          throw originalErr;
        }
      }

      return results;
    },
  };
}
