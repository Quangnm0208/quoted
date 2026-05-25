/**
 * Perplexity citation provider — uses the public Sonar API.
 * Docs: https://docs.perplexity.ai/api-reference/chat-completions-post
 *
 * Configured when PERPLEXITY_API_KEY is set. CITATIONS_TEST_MODE=true
 * short-circuits to a synthetic response so tests + local dev work
 * without a real key (mirrors LEMONSQUEEZY_TEST_MODE).
 */

import db from '../../../../../core/db/connection.js';

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';

export default {
  id: 'perplexity',

  isConfigured() {
    return !!process.env.PERPLEXITY_API_KEY || process.env.CITATIONS_TEST_MODE === 'true';
  },

  async search(query) {
    if (process.env.CITATIONS_TEST_MODE === 'true') {
      return mockResults(query);
    }
    const apiKey = process.env.PERPLEXITY_API_KEY;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: query }],
        return_citations: true,
        max_tokens: 800,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { results: [], raw: { error: `HTTP ${res.status}`, body: body.slice(0, 500) } };
    }
    const data = await res.json();
    // Perplexity returns citations array of URLs + the assistant message.
    const urls = Array.isArray(data?.citations) ? data.citations : [];
    const msg  = data?.choices?.[0]?.message?.content || '';
    return {
      results: urls.map((url, i) => ({
        url,
        snippet: msg.slice(0, 300),
        score: i === 0 ? 0.95 : 0.80,  // first cite weighted higher
      })),
      raw: data,
    };
  },
};

function mockResults(query) {
  // Return one URL per registered tenant domain so every test (which uses
  // a unique random domain) gets matched. Querying the tenants table from
  // a provider isn't ideal architecturally, but it's gated to test mode only.
  // Production providers never reach this function.
  let domains = [];
  try {
    domains = db.prepare(`SELECT domain FROM tenants WHERE domain IS NOT NULL`).all()
      .map(r => r.domain).filter(d => d && d !== 'localhost');
  } catch { /* fallback below */ }
  if (domains.length === 0) domains = ['marcus-outdoor.test'];

  return {
    results: domains.map((d, i) => ({
      url: `https://${d}/best-running-shoes-2026/`,
      snippet: `[test mode] mock result for "${query}" on ${d}`,
      score: i === 0 ? 0.95 : 0.80,
    })),
    raw: { _mock: true, query, domains },
  };
}
