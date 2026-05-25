/**
 * Citation provider registry.
 *
 * Each provider polls an AI search API for a tenant's known query set and
 * returns the cited URLs. The service walks the citations.providers map
 * for every CITATIONS_PROVIDER_* env that's set; unconfigured providers
 * silently skip.
 *
 * Interface:
 *   {
 *     id: string,                                       // 'perplexity' | 'tavily' | 'serper'
 *     isConfigured(): boolean,                          // true if its API key env is set
 *     async search(query: string): Promise<{
 *       results: Array<{ url, title?, snippet?, score? }>,
 *       raw?: any,
 *     }>
 *   }
 */

import perplexityProvider from './perplexity.js';
import tavilyProvider     from './tavily.js';
import serperProvider     from './serper.js';

const ALL = [perplexityProvider, tavilyProvider, serperProvider];

export function listConfigured() {
  return ALL.filter(p => p.isConfigured());
}

export function getProvider(id) {
  return ALL.find(p => p.id === id) || null;
}

export function listAllIds() {
  return ALL.map(p => p.id);
}
