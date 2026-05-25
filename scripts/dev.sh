#!/usr/bin/env bash
# dev.sh — run backend (:4000) + frontend (:5500) in foreground.
#
# Ctrl-C kills both. Logs interleaved with [BE] / [FE] prefixes.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# Pre-flight — fail loud if bootstrap hasn't run.
if [ ! -d backend/omniplug/node_modules ]; then
  echo "✗ backend deps missing. Run: bash scripts/bootstrap.sh"
  exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "✗ frontend deps missing. Run: bash scripts/bootstrap.sh"
  exit 1
fi
if [ ! -f backend/omniplug/.env ]; then
  echo "✗ backend/omniplug/.env missing. Run: bash scripts/bootstrap.sh"
  exit 1
fi

cleanup() {
  echo ""
  echo "Stopping…"
  jobs -p | xargs -r kill 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Backend — pipe through a prefix.
(
  cd backend/omniplug
  node --env-file=.env src/core/db/migrate.js 2>&1 | sed 's/^/[BE] /'
  node --env-file=.env src/backend/server.js 2>&1 | sed 's/^/[BE] /'
) &
BE_PID=$!

# Give backend a head start.
sleep 2

# Frontend.
(
  cd frontend
  node node_modules/.bin/serve -l 5500 -n 2>&1 | sed 's/^/[FE] /'
) &
FE_PID=$!

echo ""
echo "▸ Backend:  http://127.0.0.1:4000     (admin: http://127.0.0.1:4000/admin/)"
echo "▸ Frontend: http://127.0.0.1:5500     (pricing: http://127.0.0.1:5500/pricing)"
echo ""
echo "Ctrl-C to stop."
wait
