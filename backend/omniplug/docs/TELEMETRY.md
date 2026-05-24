# Telemetry

OmniPlug CMS Core sends an anonymous heartbeat to OmniPlug on boot and every
24 hours. This helps OmniPlug understand active versions, deployment shape and
tenant scale so security fixes and maintenance work can be prioritized.

Telemetry is best-effort. Network errors never block boot, never fail requests
and are silent in production.

## Opt Out

Set this environment variable:

```text
TELEMETRY_ENABLED=false
```

To send heartbeats to a different endpoint for testing:

```text
OMNIPLUG_TELEMETRY_URL=https://telemetry.omniplug.com/v1/heartbeat
```

## What Is Sent

- Random instance UUID generated on first boot
- Product identifier: `omniplug-cms-core`
- OmniPlug CMS Core version
- NODE_ENV
- Node.js version
- Active tenant count
- Default domain from TENANT_DEFAULT_DOMAIN or Fly app hostname
- Timestamp

## What Is Not Sent

- Customer or tenant content
- User accounts
- Emails
- IP addresses
- Tenant slugs or tenant names
- Lead, article, page, media or project data
- Any database data beyond the active tenant count

## Payload Schema

```json
{
  "instance_uuid": "4f3b2c1d-7e20-47c8-ae64-4e66e21e6b3f",
  "product": "omniplug-cms-core",
  "version": "1.3.0",
  "node_env": "production",
  "node_version": "22.11.0",
  "tenant_count": 1,
  "domain": "example.com",
  "timestamp": "2026-05-14T12:00:00.000Z"
}
```

## Instance Identity

Migration `010_instance_identity.sql` creates a singleton table named
`instance_identity`. On first boot, OmniPlug CMS Core stores one random UUID.
That UUID is stable across restarts as long as the SQLite database is preserved.
