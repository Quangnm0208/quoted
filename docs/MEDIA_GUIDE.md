# Media Guide

> **Status in v0.5.0:** Backend works; admin UI button is M6.
> Cross-ref: [`05_MEDIA_SYSTEM.md`](./05_MEDIA_SYSTEM.md) for full status.

## What works today

| Capability | How |
|---|---|
| List media in admin | Admin → Media → table of files (filename, size, type, uploaded date) |
| Upload via API | `curl -X POST -H "Authorization: Bearer $JWT" -F "file=@/path/to/image.png" http://localhost:4000/api/admin/media` |
| Edit alt text via API | `curl -X PATCH -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"alt":"…"}' http://localhost:4000/api/admin/media/<id>` |
| Delete via API | `curl -X DELETE -H "Authorization: Bearer $JWT" http://localhost:4000/api/admin/media/<id>` |
| Get public URL | `http://<api>/uploads/<filename>` |

## What doesn't yet work (M6 roadmap)

| Capability | Why blocking | Workaround |
|---|---|---|
| Drag-and-drop upload in admin UI | UI button not built; API works | Use curl or Postman |
| Inline alt-text edit in admin | UI not built | Use curl PATCH |
| Thumbnail grid | UI not built | View raw file list in admin Media tab |
| Media picker in Pages editor (attach to section) | UI not built | Paste media URL manually into `payload.media.url` JSON field |
| `<img>` tag in hero/sections rendering from CMS | No `data-cms-src` consumer wired on `index.html` yet | M6 will add this |

## Constraints (configured)

| Limit | Default | Env var |
|---|---|---|
| Max file size | 3 MB | `UPLOAD_MAX_SIZE` |
| Allowed MIME types | image/png, image/jpeg, image/webp, image/svg+xml, image/gif, application/pdf | configured in `media.service.js` |
| Storage location | `./uploads` on disk | `UPLOAD_DIR` |
| Public URL prefix | `/uploads` | `UPLOAD_PUBLIC_URL` |

## How to upload an image right now (CEO workflow)

1. Open Terminal (or ask developer)
2. Get an admin JWT:
   ```bash
   JWT=$(curl -sS -X POST -H "Content-Type: application/json" \
     -d '{"email":"admin@quoted.local","password":"<your-pw>"}' \
     http://localhost:4000/api/auth/login | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
   ```
3. Upload a file:
   ```bash
   curl -X POST -H "Authorization: Bearer $JWT" \
     -F "file=@/path/to/your/logo.png" \
     http://localhost:4000/api/admin/media
   ```
4. Response includes `{id, filename, url}`. The `url` is the public path.
5. (Optional) Edit alt text:
   ```bash
   curl -X PATCH -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
     -d '{"alt":"Quoted logo"}' \
     http://localhost:4000/api/admin/media/<id>
   ```
6. Use the public URL in a Section's payload:
   ```json
   { "media": { "url": "/uploads/abc123.png", "alt": "Quoted logo" } }
   ```

## Production storage

Local disk works for low volume. For scale:
- Fly.io persistent volume — already configured in `fly.toml`
- For multi-region or backup: swap `media.service.js` storage adapter to S3 / Cloudflare R2 (boundary already exists in code)

## Production CDN

Cloudflare (in front of `api.quotedeasy.com` if proxied, OR directly via `quotedeasy.com/uploads/*` if served by Pages) automatically caches the `/uploads/*` static path with the 1-year `immutable` cache header set by `server.js:222`. Files don't change after upload (each upload generates a unique filename) so this is safe.
