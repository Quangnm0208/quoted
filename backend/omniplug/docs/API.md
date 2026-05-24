# API Contract

## Public

```text
GET  /api/public/site
GET  /api/public/pages/:slug
GET  /api/public/articles
GET  /api/public/articles/:slug
GET  /api/public/projects
GET  /api/public/projects/:slug
POST /api/public/leads
GET  /api/health
```

Public routes resolve tenants by host. Production does not fallback to the default tenant when the host is unknown.

Field `website` là honeypot trap. Frontend MUST NOT render input này visible.
Nếu non-empty, request bị silently dropped (response 201 giả).

## Admin

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/change-password
GET/POST/PUT/PATCH/DELETE /api/admin/*
```

Admin routes resolve tenants from the authenticated user.

## Frontend Integration Inputs

```text
API base URL
tenant domain
public endpoints
lead submit endpoint
media URL
```

Frontends must not depend on internal database tables or migration details.
