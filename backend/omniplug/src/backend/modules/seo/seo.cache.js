/**
 * seo/seo.cache.js — Per-tenant in-process LRU cache for generated SEO surfaces.
 *
 * Why this exists:
 *   Sitemap/llms.txt/feed are deterministic outputs of (tenant content +
 *   industry config). Regenerating them on every request is wasteful when the
 *   underlying data changes maybe a few times an hour. CDN cache headers
 *   (s-maxage) handle the bulk of traffic at the edge, but the origin still
 *   gets revalidation requests — those should hit memory, not SQLite.
 *
 * Tradeoffs:
 *   - In-process only. Multi-machine Fly deployments will have one cache per
 *     VM. That is fine: each VM is correct on its own (event bus invalidates
 *     the VM that handled the write; the other VMs serve stale until their
 *     TTL expires — at most 60s). When we move to >1 VM we can plug in Redis
 *     via the same get/set interface without changing call sites.
 *   - Bounded by entry count, not bytes. Largest entry (50k-article sitemap
 *     XML) is ~6MB worst case; capped at 500 entries that's ~3GB worst case,
 *     which is more than Fly's 512MB. So in practice MAX_ENTRIES * average
 *     entry size has to be sized to ~50MB. Default keeps it conservative.
 *   - Soft TTL of 60s acts as a safety net if event-bus invalidation misses
 *     a publish (e.g., direct SQL writes). Without TTL a missed invalidation
 *     means stale forever.
 *
 * Invalidation sources:
 *   1. Event bus emits 'article.published', 'article.unpublished',
 *      'project.created', 'project.updated' etc. → invalidate that tenant's
 *      SEO entries.
 *   2. Time-based fallback (60s).
 *
 * Hot-path budget: get() must be < 50µs. Map.get + Date.now compare is fine.
 */

const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 60_000;

// Map preserves insertion order — used as a poor-man's LRU.
const store = new Map();

function makeKey(tenantId, surface) {
  return tenantId + ':' + surface;
}

export const seoCache = {
  /**
   * Get cached value for a tenant's surface. Returns the cached value if
   * present and not expired, else null.
   */
  get(tenantId, surface) {
    const k = makeKey(tenantId, surface);
    const entry = store.get(k);
    if (!entry) return null;
    if (entry.expires_at < Date.now()) {
      store.delete(k);
      return null;
    }
    // Touch: move to most-recently-used position.
    store.delete(k);
    store.set(k, entry);
    return entry.value;
  },

  /**
   * Set cached value. Evicts oldest entry if at capacity.
   */
  set(tenantId, surface, value, ttlMs = DEFAULT_TTL_MS) {
    const k = makeKey(tenantId, surface);
    if (store.has(k)) store.delete(k);
    if (store.size >= MAX_ENTRIES) {
      // Evict oldest (first inserted).
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) store.delete(oldestKey);
    }
    store.set(k, { value, expires_at: Date.now() + ttlMs });
  },

  /**
   * Invalidate all SEO surfaces for a tenant. Called from event bus
   * subscribers when content changes.
   */
  invalidateTenant(tenantId) {
    const prefix = tenantId + ':';
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },

  /** Test/debug helper. Do not use in production code. */
  _debugSize() {
    return store.size;
  },

  /** Test/debug helper. */
  _debugClear() {
    store.clear();
  },
};
