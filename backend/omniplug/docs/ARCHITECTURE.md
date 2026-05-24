# Architecture

OmniPlug CMS Core is an Express and SQLite CMS/API core with a shared-schema tenant model.

Target structure:

```text
src/
  core/
    db/
    lib/
    errors/
    response/
    security/
    tenancy/
  backend/
    server.js
    routes/
    middleware/
    modules/
  cms/
    admin/
    sdk/
  extensions/
  shared/
```

Current code keeps compatibility with the existing module layout while enforcing these rules for new work:

- Controllers do not own SQL.
- Repositories require tenant id for tenant-scoped data.
- Services own business workflow.
- Startup migrations run before schema verification and server boot.
- Public frontends integrate through APIs only.

Known non-blocking debt: some older controllers still contain validation and workflow decisions that should move into services over time. SQL access has been moved out of the release-blocking controllers.
