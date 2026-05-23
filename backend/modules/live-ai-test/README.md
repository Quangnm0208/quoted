# live-ai-test module

**Status:** Phase 0 stub. Full implementation in Phase 1 (Month 3-4).

Files in Phase 1 will include:
- `live-ai-test.service.js` — orchestrator + quota enforcement
- `perplexity.client.js` — streaming Sonar API client
- `prompt-rewriter.js` — pre/post processing for cleaner results
- `citation-highlighter.js` — mark tenant URLs in response

Phase 0 returns 501 so the WP plugin's "Test it live" button gracefully falls
back to a placeholder message (see admin/partials/onboarding.php step 4).
