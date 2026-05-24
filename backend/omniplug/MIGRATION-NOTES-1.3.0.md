# Migration Notes 1.3.0

Upgrade path: OmniPlug CMS Core 1.2.x -> 1.3.0.

1. Back up the SQLite database and uploads volume.
2. Deploy the 1.3.0 image or source package.
3. Set production admin secrets:
   - ADMIN_EMAIL is required.
   - ADMIN_INITIAL_PASSWORD is required.
   - ADMIN_INITIAL_PASSWORD must not be `ChangeMe123!`.
   - ADMIN_INITIAL_PASSWORD must be at least 12 characters.
4. Review telemetry:
   - Default: TELEMETRY_ENABLED=true.
   - Opt out with TELEMETRY_ENABLED=false.
   - Optional override: OMNIPLUG_TELEMETRY_URL.
5. Run migrations before serving traffic:
   - `node src/core/db/migrate.js`
   - Confirms migration `010_instance_identity.sql`.
6. Verify schema:
   - `node scripts/verify-schema.js`
7. Start the server.
8. Check `/api/health` returns:
   - `version: "1.3.0"`
   - `vendor: "OmniPlug"`
   - `license: "PolyForm Noncommercial 1.0.0"`
9. Confirm `instance_identity` has exactly one UUID row.
10. Confirm public lead forms do not render a visible `website` input.

No dependency upgrade is required for 1.3.0.
