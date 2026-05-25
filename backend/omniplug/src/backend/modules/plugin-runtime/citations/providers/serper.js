/**
 * Serper citation provider — Google search wrapper.
 * Docs: https://serper.dev/api-reference
 */

const ENDPOINT = 'https://google.serper.dev/search';

export default {
  id: 'serper',

  isConfigured() { return !!process.env.SERPER_API_KEY; },

  async search(query) {
    const apiKey = process.env.SERPER_API_KEY;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 8 }),
    });
    if (!res.ok) {
      return { results: [], raw: { error: `HTTP ${res.status}` } };
    }
    const data = await res.json();
    const organic = data.organic || [];
    return {
      results: organic.map((r, i) => ({
        url: r.link,
        title: r.title,
        snippet: r.snippet?.slice(0, 300),
        score: 0.7 - i * 0.05,  // rank-based decay
      })),
      raw: data,
    };
  },
};
