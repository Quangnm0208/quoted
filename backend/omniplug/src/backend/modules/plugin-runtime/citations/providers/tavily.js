/**
 * Tavily citation provider — uses /search endpoint.
 * Docs: https://docs.tavily.com/docs/rest-api/api-reference
 */

const ENDPOINT = 'https://api.tavily.com/search';

export default {
  id: 'tavily',

  isConfigured() { return !!process.env.TAVILY_API_KEY; },

  async search(query) {
    const apiKey = process.env.TAVILY_API_KEY;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 8,
        include_answer: false,
      }),
    });
    if (!res.ok) {
      return { results: [], raw: { error: `HTTP ${res.status}` } };
    }
    const data = await res.json();
    return {
      results: (data.results || []).map(r => ({
        url: r.url,
        title: r.title,
        snippet: r.content?.slice(0, 300),
        score: r.score ?? 0.6,
      })),
      raw: data,
    };
  },
};
