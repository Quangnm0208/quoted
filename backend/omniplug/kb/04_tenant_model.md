# Tenant Model

OmniPlug CMS Core uses shared-schema tenancy. Tenant-scoped tables require `tenant_id` and repositories must fail if tenant id is missing.

Production host resolution is strict. Development may fallback to the default tenant for local ergonomics.
