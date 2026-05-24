/**
 * TenantScopedRepository.js — Base class enforcing tenant scope at construction.
 *
 * Problem this solves:
 *   The previous repository pattern accepts `tenantId` as a method argument
 *   (e.g. `repo.findById(id, tenantId)`). One forgotten argument = cross-tenant
 *   leak. JavaScript does not enforce arity; tests with a single tenant won't
 *   detect the leak; lint catches some SQL patterns but not all.
 *
 * Capability pattern:
 *   Tenant scope is bound at construction. Methods cannot operate without it
 *   because the value is read from `this.tenantId`, which is non-writable.
 *   Calling code MUST instantiate via `TheRepo.scopeTo(tenantId)`.
 *
 * Usage:
 *   class ProjectsRepository extends TenantScopedRepository {
 *     constructor(tenantId) {
 *       super(tenantId);
 *       this.#stmt = lazyPrepare(() => ({
 *         findBySlug: db.prepare(
 *           'SELECT * FROM projects WHERE slug = ? AND tenant_id = ? AND deleted_at IS NULL'
 *         ),
 *       }));
 *     }
 *     findBySlug(slug) {
 *       // tenantId is on `this`, cannot be forgotten or substituted
 *       return this.#stmt().findBySlug.get(slug, this.tenantId);
 *     }
 *   }
 *
 *   // Service:
 *   const repo = ProjectsRepository.scopeTo(ctx.tenantId);
 *   const project = repo.findBySlug('foo');
 *
 * Migration strategy:
 *   - All NEW repositories MUST extend this class.
 *   - Existing flat `projectsRepository = { ... }` modules can stay until their
 *     next significant change — then convert. No big-bang rewrite required.
 *   - The `scopeTo` static is a factory so subclasses don't need to redeclare
 *     a constructor signature contract.
 */

export class TenantScopedRepository {
  constructor(tenantId) {
    if (tenantId === undefined || tenantId === null) {
      throw new Error(
        `${this.constructor.name}: refusing to construct without tenantId. ` +
        `Every tenant-scoped repository must bind tenantId at construction ` +
        `to prevent cross-tenant data access.`
      );
    }
    if (typeof tenantId !== 'number' || !Number.isInteger(tenantId) || tenantId < 1) {
      throw new Error(
        `${this.constructor.name}: invalid tenantId (${typeof tenantId}: ${tenantId}). ` +
        `Expected a positive integer.`
      );
    }
    // Non-writable so callers cannot mutate scope after construction.
    Object.defineProperty(this, 'tenantId', {
      value: tenantId,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  }

  /**
   * Factory: `ProjectsRepository.scopeTo(tenantId)`.
   * Calling code reads more clearly than `new ProjectsRepository(tenantId)`,
   * and emphasizes the capability nature of the binding.
   */
  static scopeTo(tenantId) {
    return new this(tenantId);
  }
}
