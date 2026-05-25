# API Contract — WP Plugin ↔ Quoted Backend

**Version:** 1 (used in URL path: `/api/v1/...`)
**Auth:** JWT Bearer token in `Authorization` header (except where noted)
**Content type:** `application/json` (except llms.txt and markdown endpoints)

---

## Public endpoints (no auth required)

### `GET /api/public/llm/sitemap.txt`

Returns the llms.txt content for the tenant identified by the `X-Quoted-Domain`
request header. (Earlier draft used `Host` for tenant lookup; this is
incompatible with vhost-routing reverse proxies like Cloudflare and Fly.io,
which require Host to match the backend hostname.)

**Request:**
```http
GET /api/public/llm/sitemap.txt HTTP/1.1
Host: api.quoted.io
X-Quoted-Domain: marcus-outdoor.com
User-Agent: ClaudeBot/1.0
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
Cache-Control: public, max-age=300, s-maxage=86400
X-Quoted-Version: 1

# Marcus Outdoor

> A blog about outdoor gear, hiking, and running.

## Posts

- [Best Running Shoes 2026](https://marcus-outdoor.com/llm/best-running-shoes-2026.md): Comprehensive review of 12 top picks.
- [Hoka vs Brooks: Marathon Edition](https://marcus-outdoor.com/llm/hoka-vs-brooks-marathon.md): Side-by-side comparison.
...
```

**Errors:**
- `404` — X-Quoted-Domain doesn't resolve to a known tenant
- `503` — Backend not yet warm-cached this tenant; retry in 30s

### `GET /api/public/llm/posts/:slug.md`

Returns clean markdown for a single post.

**Request:**
```http
GET /api/public/llm/posts/best-running-shoes-2026.md HTTP/1.1
Host: api.quoted.io
X-Quoted-Domain: marcus-outdoor.com
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
Cache-Control: public, max-age=300, s-maxage=86400

# Best Running Shoes 2026

Author: Marcus Doe
Published: 2026-04-15
Updated: 2026-05-10

After testing 12 pairs over 400 miles, here are my top picks...
```

**Errors:**
- `404` — Slug not found or not published
- `410` — Post was deleted (allows AI to invalidate cache)

---

## Plugin authentication

### `POST /api/v1/wp-sites/register`

Called once on plugin activation with license key.

**Request:**
```http
POST /api/v1/wp-sites/register HTTP/1.1
Content-Type: application/json

{
  "license_key": "8a7b6c5d-4e3f-2a1b-0c9d-1234567890ab",  // Lemon Squeezy UUID
  "domain": "marcus-outdoor.com",
  "wp_version": "6.5.2",
  "plugin_version": "0.1.0",
  "site_name": "Marcus Outdoor",
  "admin_email": "marcus@marcus-outdoor.com"
}
```

**Response (201):**
```json
{
  "tenant_id": "tnt_8f2a91...",
  "jwt": "eyJhbGciOiJSUzI1NiIs...",
  "jwt_expires_at": "2026-05-24T10:00:00Z",
  "plan": "free",
  "quota": {
    "posts_limit": 50,
    "history_days": 7,
    "live_tests_per_month": 3
  }
}
```

**Errors:**
- `400 INVALID_LICENSE_FORMAT` — Key doesn't match expected format
- `403 DOMAIN_MISMATCH` — License issued for a different domain
- `410 LICENSE_EXPIRED` — License past expiry date
- `410 LICENSE_REVOKED` — License in CRL
- `429 RATE_LIMITED` — Too many registration attempts (anti-brute-force)

### `POST /api/v1/wp-sites/refresh-token`

Renew JWT before expiry. Plugin calls this when JWT is <1h from expiring.

**Request:**
```http
POST /api/v1/wp-sites/refresh-token HTTP/1.1
Authorization: Bearer <current_jwt>
```

**Response (200):**
```json
{
  "jwt": "eyJhbGciOiJSUzI1NiIs...",
  "jwt_expires_at": "2026-05-24T10:00:00Z"
}
```

**Errors:**
- `401 JWT_EXPIRED` — Re-register with license key required

---

## Bot crawl ingestion

### `POST /api/v1/bot-crawls/batch`

Plugin sends hourly batches.

**Request:**
```http
POST /api/v1/bot-crawls/batch HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "batch_id": "btc_2026052310...",
  "events": [
    {
      "bot_name": "ClaudeBot",
      "url_path": "/best-running-shoes-2026/",
      "user_agent": "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "ip_hash": "sha256:abc123def456...",
      "crawled_at": "2026-05-23T10:32:00Z"
    },
    {
      "bot_name": "GPTBot",
      "url_path": "/hoka-vs-brooks-marathon/",
      "user_agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot",
      "ip_hash": "sha256:def789abc012...",
      "crawled_at": "2026-05-23T10:45:00Z"
    }
  ]
}
```

**Response (202):**
```json
{
  "accepted": 2,
  "deduped": 0,
  "rejected": 0,
  "rejected_reasons": []
}
```

**Validation:**
- `events.length` must be 1–500
- `bot_name` must be from allowlist (case-insensitive)
- `url_path` must be ≤2048 chars, starts with `/`
- `crawled_at` must be ISO 8601 UTC, within last 7 days
- `ip_hash` must be `sha256:` prefix + 64 hex chars

**Errors:**
- `400 INVALID_BATCH` — Schema validation failed
- `401 JWT_INVALID` — Token bad or expired
- `429 RATE_LIMITED` — Max 24 batches/hour per site
- `413 BATCH_TOO_LARGE` — >500 events

---

## Post sync

### `POST /api/v1/wp-sites/posts/sync`

Plugin syncs post metadata. Backend stores in `articles` table (reused).

**Request:**
```http
POST /api/v1/wp-sites/posts/sync HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "posts": [
    {
      "wp_post_id": 1234,
      "slug": "best-running-shoes-2026",
      "title": "Best Running Shoes 2026",
      "excerpt": "After testing 12 pairs over 400 miles...",
      "content_html": "<p>After testing...</p><h2>1. Hoka Bondi</h2>...",
      "author": "Marcus Doe",
      "categories": ["running-gear", "reviews"],
      "tags": ["running-shoes", "2026"],
      "published_at": "2026-04-15T08:00:00Z",
      "modified_at": "2026-05-10T14:30:00Z",
      "url": "https://marcus-outdoor.com/best-running-shoes-2026/"
    }
  ]
}
```

**Response (200):**
```json
{
  "synced": 1,
  "skipped_over_quota": 0,
  "errors": []
}
```

**Notes:**
- Backend dedupes by `wp_post_id + tenant_id`
- If quota exceeded (50 posts on free), additional posts return as
  `skipped_over_quota` (not an error)
- Content HTML is sanitized backend-side before storage

---

## Dashboard data

### `GET /api/v1/dashboard/summary`

Powers admin dashboard.

**Request:**
```http
GET /api/v1/dashboard/summary?days=7 HTTP/1.1
Authorization: Bearer <jwt>
```

**Response (200):**
```json
{
  "ai_distribution_score": 87,
  "score_delta_7d": 12,
  "next_action": {
    "id": "add_llms_entries",
    "title": "Add llms.txt entries for 3 posts",
    "description": "3 of your top posts aren't in your llms.txt yet.",
    "action_url": "/wp-admin/admin.php?page=quoted-content"
  },
  "bot_activity": {
    "total_crawls_7d": 47,
    "unique_bots_7d": 4,
    "top_bots": [
      { "bot_name": "ClaudeBot", "count": 18 },
      { "bot_name": "GPTBot", "count": 14 },
      { "bot_name": "PerplexityBot", "count": 9 },
      { "bot_name": "GoogleExtended", "count": 6 }
    ],
    "recent_crawls": [
      {
        "bot_name": "ClaudeBot",
        "url_path": "/best-running-shoes-2026/",
        "crawled_at": "2026-05-23T08:32:00Z",
        "human_time": "2 hours ago"
      }
    ]
  },
  "posts": {
    "synced": 47,
    "quota": 50,
    "quota_used_pct": 94
  },
  "citations": {
    "verified_count_7d": 0,
    "likely_count_7d": 0,
    "tier_required": "pro"
  }
}
```

---

## Live AI Test (Phase 1)

### `POST /api/v1/live-test/query`

Proxy to Perplexity. Free tier: 3/month. Pro tier: 100/month soft cap.

**Request:**
```http
POST /api/v1/live-test/query HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "prompt": "What are the best running shoes for marathon training in 2026?"
}
```

**Response (200, streamed):**
```
data: {"type":"start"}

data: {"type":"chunk","text":"Based on recent reviews..."}

data: {"type":"chunk","text":" Marcus Outdoor recommends..."}

data: {"type":"citations","citations":[
  {"url":"https://marcus-outdoor.com/best-running-shoes-2026/","cited":true},
  {"url":"https://runnersworld.com/...","cited":false}
]}

data: {"type":"done","tokens_used":823}
```

**Errors:**
- `402 QUOTA_EXCEEDED` — Free tier exhausted this month
- `429 RATE_LIMITED` — Too many queries in last hour

---

## Common error envelope

All errors return:
```json
{
  "error": {
    "code": "DOMAIN_MISMATCH",
    "message": "License domain doesn't match request",
    "details": {
      "expected": "marcus-outdoor.com",
      "got": "marcus-outdoor.net"
    }
  }
}
```

The `code` field is stable and safe to switch on programmatically.
The `message` field is for human reading and may change.

---

## Rate limits

| Endpoint | Limit | Why |
|---|---|---|
| `POST /api/v1/wp-sites/register` | 5/hour/IP | Anti-brute-force on license keys |
| `POST /api/v1/wp-sites/refresh-token` | 24/day/site | More than 1/hour is suspicious |
| `POST /api/v1/bot-crawls/batch` | 24/hour/site | Hourly cron + 100% headroom |
| `POST /api/v1/wp-sites/posts/sync` | 12/hour/site | 30-min cron + headroom |
| `GET /api/v1/dashboard/summary` | 60/hour/site | Admin polling |
| `GET /api/public/llm/*` | 1000/hour/site/IP | Allow heavy AI crawl traffic |
| `POST /api/v1/live-test/query` | 10/hour/site | Cost protection |

Limits inherit from OmniPlug's IP rate limiter (`core/lib/rateLimiterIp.js`).

---

## Versioning

URL versioning: `/api/v1/...`. Breaking changes ship under `/api/v2/...`.

Non-breaking additions (new fields in response) don't require version bump.
Plugin should ignore unknown response fields.

When `/api/v2/` ships, `/api/v1/` is supported for 6 months. Plugin auto-
detects via `GET /api/version` and upgrades.
