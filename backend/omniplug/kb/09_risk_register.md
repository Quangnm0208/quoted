# Risk Register

| Risk | Status | Mitigation |
|---|---|---|
| Startup before migrations | Closed | `scripts/start.sh` migration-first contract |
| Foreign key drift | Closed | `scripts/verify-schema.js` checks child FK parents |
| Tenant data leak | Guarded | tenant-scoped repositories and lint guard |
| Future extension startup breakage | Guarded | future modules default off |
| Controller workflow debt | Accepted | refactor by module in later releases |
