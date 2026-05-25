# 05 — Media System Report

> **Status: backend works, admin upload UI deferred to M6.** Honest report below.

## Per-feature status

| Feature | Backend API | Admin UI | Front-end render | Status |
|---|---|---|---|---|
| Upload PNG | ✅ `POST /api/admin/media` (multipart) | ❌ form not in UI | n/a (no media block yet) | ⏳ M6 |
| Upload JPG/WebP | ✅ same | ❌ | n/a | ⏳ M6 |
| Reject unsupported file (e.g. .exe) | ✅ MIME whitelist in `media.service.js` | n/a | n/a | ✅ backend |
| Reject oversized (>3MB default) | ✅ `UPLOAD_MAX_SIZE` env enforces | n/a | n/a | ✅ backend |
| List media | ✅ `GET /api/admin/media` | ✅ read-only table in `/admin/media.html` | n/a | ✅ partial |
| Preview media | ✅ public URL via static serve | ❌ no thumbnail grid yet | n/a | ⏳ M6 |
| Edit alt text | ✅ `PATCH /api/admin/media/:id` | ❌ no edit form yet | n/a | ⏳ M6 |
| Attach to section | ✅ payload can hold `{media: {id, url, alt}}` | ❌ no picker yet (operator pastes URL into payload JSON) | ❌ no `data-cms-src` consumer in `index.html` yet | ⏳ M6 |
| Delete unused | ✅ `DELETE /api/admin/media/:id` | ❌ no delete button | n/a | ⏳ M6 |
| Render publicly | ✅ `/uploads/*` static served by Express | n/a | ❌ no media block yet | ⏳ M6 |

## API contract (already working)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/admin/media` | List media for tenant | admin JWT |
| `POST` | `/api/admin/media` | Upload file (multipart/form-data, field `file`) | admin/editor JWT |
| `PATCH` | `/api/admin/media/:id` | Update alt text / folder | admin/editor JWT |
| `DELETE` | `/api/admin/media/:id` | Delete row (file kept on disk for safety) | admin JWT |
| `GET` | `/uploads/<filename>` | Public file serve, 1y cache, CORS `*` | none |

Verified via curl smoke earlier in session. Backend mounted at `server.js:221`:
```js
app.use(env.UPLOAD_PUBLIC_URL, express.static(path.resolve(env.UPLOAD_DIR), {
  maxAge: '1y', immutable: true, ...
}));
```

## Config

| Env var | Default | Purpose |
|---|---|---|
| `UPLOAD_DIR` | `./uploads` | Local filesystem path |
| `UPLOAD_PUBLIC_URL` | `/uploads` | URL prefix for public serve |
| `UPLOAD_MAX_SIZE` | `3145728` (3MB) | Byte cap |

For production:
- Local disk works for low volume (Fly.io persistent volume — already in `fly.toml`)
- For scale: swap `media.service.js` storage adapter to S3/R2 (boundary already exists)

## CEO-visible behaviour today

If CEO clicks Media in admin: sees an empty table + a warning banner:

> *"Read-only listing. Upload UI sẽ wire ở M6 (media picker cho hero/section). Upload trực tiếp qua API: `POST /api/admin/media` với multipart/form-data."*

This is HONEST — not a fake-working surface. CEO knows it's deferred.

## Roadmap to "fully working" (M6 spec)

1. Add drag-and-drop upload zone to `media.html` (renderMedia in page-content.js)
2. Add thumbnail grid view
3. Add alt-text inline edit + Save handler
4. Add media-picker modal that section forms (Pages page) can invoke → returns selected `{id, url, alt}` → injects into `payload.media`
5. Add `data-cms-src` consumer wiring on `index.html` hero card for the hero image
6. Smoke test: upload → attach → publish → render on frontend
