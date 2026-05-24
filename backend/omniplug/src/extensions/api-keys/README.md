# API Keys Extension (historical placeholder)

**API key authentication is implemented in OmniPlug CMS Core v1.4.4.** The
canonical implementation lives in:

- `src/core/middleware/apiKey.js` — request-time verification (bcrypt + LRU
  burst bucket + per-IP rate limit). Gates `/api/v1/*`.
- `src/core/lib/apiKeyMint.js` — minting, parsing, timing-safe verification.
- `scripts/op-create-api-key.js` — operator CLI for minting customer keys.
- `scripts/op-revoke-api-key.js` — revoke by prefix.

This directory is kept only as a historical placeholder from the v1.2.x
extension scaffolding. Do not add code here — use the locations above.
