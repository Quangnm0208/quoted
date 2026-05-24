#!/bin/sh
set -e

# v1.4.3 fix: read version from package.json instead of hardcoding.
VERSION=$(node -p "require('./package.json').version")

echo "[startup] Product: OmniPlug CMS Core"
echo "[startup] Version: ${VERSION}"
echo "[startup] Running migrations..."
node src/core/db/migrate.js

echo "[startup] Running schema verification..."
node scripts/verify-schema.js

echo "[startup] Starting server..."
exec node src/backend/server.js
