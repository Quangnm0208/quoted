/**
 * Perplexity Sonar client for /live-test/query.
 *
 * Production: requires PERPLEXITY_API_KEY.
 * Test mode (LIVE_AI_TEST_MODE=true): returns a synthetic response so
 * local dev + CI work without a real key.
 *
 * Returns { answer, citations: [{ url, cited }] } — non-streaming for v1.
 * Streaming SSE comes in v0.5.
 */

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';

export async function ask(prompt, { tenantDomain } = {}) {
  if (process.env.LIVE_AI_TEST_MODE === 'true') {
    return mockAsk(prompt, tenantDomain);
  }
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    const e = new Error('PERPLEXITY_API_KEY not set');
    e.code = 'PROVIDER_NOT_CONFIGURED';
    e.httpStatus = 503;
    throw e;
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'application/json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      return_citations: true,
      max_tokens: 800,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const e = new Error(`Perplexity HTTP ${res.status}`);
    e.code = 'UPSTREAM_ERROR';
    e.httpStatus = 502;
    e.details = body.slice(0, 500);
    throw e;
  }
  const data = await res.json();
  const answer    = data?.choices?.[0]?.message?.content || '';
  const rawUrls   = Array.isArray(data?.citations) ? data.citations : [];
  const tenantHost = tenantDomain ? tenantDomain.toLowerCase() : null;

  return {
    answer,
    citations: rawUrls.map(url => ({
      url,
      cited: tenantHost ? isOwnedByTenant(url, tenantHost) : false,
    })),
    tokens_used: data?.usage?.total_tokens || null,
  };
}

function isOwnedByTenant(url, tenantHost) {
  try {
    const host = new URL(url).host.replace(/^www\./, '').toLowerCase();
    return host === tenantHost;
  } catch { return false; }
}

function mockAsk(prompt, tenantDomain) {
  const owned = tenantDomain
    ? `https://${tenantDomain.replace(/^www\./, '')}/best-running-shoes-2026/`
    : 'https://example.com/owned';
  return {
    answer:
      `[test mode] Based on recent reviews, ${tenantDomain || 'your site'} recommends ` +
      `Hoka Bondi for cushioning and Brooks Ghost for daily mileage. ` +
      `(Mock answer to: "${prompt.slice(0, 80)}")`,
    citations: [
      { url: owned, cited: true },
      { url: 'https://runnersworld.com/gear', cited: false },
      { url: 'https://reddit.com/r/running', cited: false },
    ],
    tokens_used: 312,
    _mock: true,
  };
}
