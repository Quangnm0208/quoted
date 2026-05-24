# backend/

This folder vendors OmniPlug CMS Core v1.4.4 and the Quoted overlay applied
in-place. Everything you need to run the API locally lives under
`backend/omniplug/`.

## Layout

```
backend/
└── omniplug/                       OmniPlug CMS Core v1.4.4 (vendored)
    ├── src/
    │   ├── core/                   Upstream OmniPlug — DO NOT edit unless
    │   │                           the change is documented as a v1.4.4 bugfix.
    │   ├── core/db/migrations/
    │   │   ├── 001 … 024_*.sql     Upstream migrations
    │   │   ├── 025_quoted_wp_sites.sql       (overlay)
    │   │   ├── 026_quoted_bot_crawls.sql     (overlay)
    │   │   ├── 027_quoted_citations.sql      (overlay)
    │   │   ├── 028_quoted_notif_prefs.sql    (overlay)
    │   │   └── 029_quoted_posts.sql          (overlay)
    │   └── backend/modules/
    │       ├── (upstream OmniPlug modules)
    │       ├── wp-sites/           (overlay) plugin register / refresh / sync
    │       ├── bot-crawls/         (overlay) hourly batch ingestion
    │       ├── citations/          (overlay) Phase 0 stub
    │       ├── live-ai-test/       (overlay) Phase 0 stub
    │       └── llms-content/       (overlay) public llms.txt + post markdown
    ├── scripts/
    │   ├── op-license-sign.js      Upstream operator-key signing CLI
    │   ├── op-key-generate.js      Upstream operator-key generator
    │   └── qtd-license-sign.js     (overlay) wraps op-license-sign into the
    │                               `qtd_(live|test)_<jwt>` envelope the WP
    │                               plugin expects.
    └── keys/                       op-license-pub.pem committed; *.priv.pem
                                    is .gitignored and operator-managed.
```

## Overlay rules

1. **Upstream files** under `omniplug/src/core/`, `omniplug/src/backend/modules/`
   that already exist (articles, leads, tenants, etc.) are untouched. The only
   upstream edit is `src/backend/server.js`, which gets five new route mounts
   for the Quoted overlay (search for "Quoted overlay" in that file).
2. **Quoted migrations** start at `025_*` to avoid collision with upstream `001-024`.
   They use `INTEGER` tenant_id with `FK REFERENCES tenants(id)` to match the
   upstream tenancy model.
3. **Quoted modules** live alongside upstream modules under
   `src/backend/modules/` but only reference each other (and upstream core/lib
   helpers) — no upstream module imports from a quoted module.
4. **The plugin auth path is separate.** Quoted uses an HS256 plugin JWT
   (`signPluginJwt` in `wp-sites/quoted-licenses.js`) — distinct from
   OmniPlug's admin-user JWT (`signToken` in `core/lib/jwt.js`). Both share
   `JWT_SECRET` but the payloads do not overlap.

## Run

See the repo root `README.md` for the one-command local-run flow.
