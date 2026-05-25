/**
 * @quoted/sdk — typed JavaScript client for the Quoted backend.
 *
 * Mirrors the WP plugin's PHP client (wp-plugin/includes/class-quoted-
 * backend-client.php) so any JS integrator (Next.js, Astro, Express
 * middleware, edge worker) talks to the same backend with the same
 * contract. No build step — pure ESM, browser + Node compatible.
 *
 * Quick start:
 *   import { QuotedClient } from '@quoted/sdk';
 *   const client = new QuotedClient({ baseUrl: 'https://api.quotedeasy.com' });
 *   const checkout = await client.payments.checkout({ plan: 'pro-monthly' });
 *   window.location = checkout.checkout_url;
 *
 * License activation (server-side only — needs network access):
 *   const { activation_token } = await client.licenses.activate({
 *     license_key: '8a7b...', site_url: 'https://my-site.com',
 *   });
 *
 * Every method throws a `QuotedError` on backend error envelope or
 * network failure. Catch it to read `.code` and `.message`.
 */

const DEFAULT_BASE_URL = 'https://api.quotedeasy.com';

export class QuotedError extends Error {
  constructor(code, message, details = null, httpStatus = null) {
    super(message);
    this.name = 'QuotedError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

export class QuotedClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetch = options.fetch || globalThis.fetch;
    if (!this.fetch) {
      throw new Error('QuotedClient: no fetch available. Pass `options.fetch` or run on Node 18+.');
    }
    this.activationToken = options.activationToken || null;
    this.pluginJwt = options.pluginJwt || null;

    this.payments  = new PaymentsApi(this);
    this.products  = new ProductsApi(this);
    this.licenses  = new LicensesApi(this);
    this.wpSites   = new WpSitesApi(this);
    this.botCrawls = new BotCrawlsApi(this);
    this.dashboard = new DashboardApi(this);
  }

  async _request(method, path, { body, token } = {}) {
    const headers = { 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
      res = await this.fetch(this.baseUrl + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new QuotedError('NETWORK_ERROR', err.message || 'Network request failed', null, null);
    }

    let json = null;
    try { json = await res.json(); } catch { /* non-json body */ }

    if (!res.ok) {
      const code    = json?.error?.code    || `HTTP_${res.status}`;
      const message = json?.error?.message || `HTTP ${res.status}`;
      const details = json?.error?.details ?? null;
      throw new QuotedError(code, message, details, res.status);
    }
    return json;
  }
}

// ─── /api/payments + /api/products ─────────────────────────────────────
class PaymentsApi {
  constructor(client) { this.c = client; }
  /**
   * Get a Lemon Squeezy hosted-checkout URL for a plan.
   * @param {{plan: string, email?: string}} input
   * @returns {Promise<{checkout_url: string}>}
   */
  checkout(input) { return this.c._request('POST', '/api/payments/checkout', { body: input }); }
}

class ProductsApi {
  constructor(client) { this.c = client; }
  /**
   * Public plan catalogue.
   * @returns {Promise<{plans: Array<{id,name,tier,billing_cycle,price_usd,features:string[]}>}>}
   */
  plans() { return this.c._request('GET', '/api/products/plans'); }
}

// ─── /api/v1/licenses ──────────────────────────────────────────────────
class LicensesApi {
  constructor(client) { this.c = client; }
  /**
   * Activate a license key against the backend (which proxies to LS).
   * On success, the returned activation_token is cached on the client
   * for subsequent validate/deactivate calls.
   */
  async activate(input) {
    const out = await this.c._request('POST', '/api/v1/licenses/activate', { body: input });
    this.c.activationToken = out.activation_token;
    return out;
  }
  validate(input) {
    return this.c._request('POST', '/api/v1/licenses/validate', { body: input, token: this.c.activationToken });
  }
  async deactivate(input) {
    const out = await this.c._request('POST', '/api/v1/licenses/deactivate', { body: input, token: this.c.activationToken });
    this.c.activationToken = null;
    return out;
  }
}

// ─── /api/v1/wp-sites ──────────────────────────────────────────────────
class WpSitesApi {
  constructor(client) { this.c = client; }
  /**
   * Register the site against the backend after license activation.
   * Caches the returned plugin JWT for subsequent runtime calls.
   */
  async register(input) {
    const body = { activation_token: this.c.activationToken, ...input };
    const out = await this.c._request('POST', '/api/v1/wp-sites/register', { body });
    this.c.pluginJwt = out.jwt;
    return out;
  }
  refreshToken() {
    return this.c._request('POST', '/api/v1/wp-sites/refresh-token', { token: this.c.pluginJwt });
  }
  postsSync(input) {
    return this.c._request('POST', '/api/v1/wp-sites/posts/sync', { body: input, token: this.c.pluginJwt });
  }
}

// ─── /api/v1/bot-crawls ────────────────────────────────────────────────
class BotCrawlsApi {
  constructor(client) { this.c = client; }
  batch(input) {
    return this.c._request('POST', '/api/v1/bot-crawls/batch', { body: input, token: this.c.pluginJwt });
  }
}

// ─── /api/v1/dashboard ─────────────────────────────────────────────────
class DashboardApi {
  constructor(client) { this.c = client; }
  summary(days = 7) {
    return this.c._request('GET', `/api/v1/dashboard/summary?days=${encodeURIComponent(days)}`, { token: this.c.pluginJwt });
  }
}

export default QuotedClient;
