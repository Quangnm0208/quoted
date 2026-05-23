# citations module

**Status:** Phase 0 stub. Full implementation in Phase 2 (Month 5-6).

See `/docs/CITATION-TRACKING-SPEC.md` for the complete algorithm spec.

Files in Phase 2 will include:
- `citations.service.js` — orchestrator
- `citations.poller.js` — cron job for Perplexity/Tavily polling
- `providers/perplexity.client.js`
- `providers/tavily.client.js`
- `domain-matcher.js` — URL canonicalization + matching
- `confidence-scorer.js` — multi-signal scoring 0.0-1.0
- `niches/*.prompts.json` — 40 niche prompt template files

In Phase 0, only the schema (migration 024) and stub endpoints exist.
