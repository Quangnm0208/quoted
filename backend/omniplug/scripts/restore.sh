#!/bin/bash
# =====================================================================
# scripts/restore.sh — Restore CMS từ backup.
#
# ⚠️ DESTRUCTIVE — sẽ ghi đè DB hiện tại + uploads.
#
# Usage:
#   ./scripts/restore.sh backups/cms-2026-05-08-0200.db [backups/uploads-2026-05-08-0200.tar.gz]
#
# Recommended workflow:
#   1. STOP server: docker compose down (hoặc systemctl stop omniplug-cms)
#   2. Backup current state: ./scripts/backup.sh
#   3. Run restore
#   4. START server lại
#   5. Verify: login admin, kiểm tra articles/projects/leads
# =====================================================================

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <db-backup.db> [uploads-backup.tar.gz]"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/cms-*.db 2>/dev/null || echo "  No backups found in ./backups/"
  exit 1
fi

DB_BACKUP="$1"
UP_BACKUP="${2:-}"

DB_PATH="${DB_PATH:-./data/cms.db}"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"

# ===== Sanity checks =====
if [ ! -f "$DB_BACKUP" ]; then
  echo "✗ DB backup file not found: $DB_BACKUP"
  exit 1
fi

if ! sqlite3 "$DB_BACKUP" "SELECT 1" > /dev/null 2>&1; then
  echo "✗ DB backup file looks corrupted: $DB_BACKUP"
  exit 1
fi

USER_COUNT=$(sqlite3 "$DB_BACKUP" "SELECT COUNT(*) FROM users;")
ARTICLE_COUNT=$(sqlite3 "$DB_BACKUP" "SELECT COUNT(*) FROM articles;" 2>/dev/null || echo "?")
LEAD_COUNT=$(sqlite3 "$DB_BACKUP" "SELECT COUNT(*) FROM leads;" 2>/dev/null || echo "?")

echo "▸ Backup info:"
echo "  File:     $DB_BACKUP ($(du -h "$DB_BACKUP" | cut -f1))"
echo "  Users:    $USER_COUNT"
echo "  Articles: $ARTICLE_COUNT"
echo "  Leads:    $LEAD_COUNT"
[ -n "$UP_BACKUP" ] && echo "  Uploads:  $UP_BACKUP ($(du -h "$UP_BACKUP" 2>/dev/null | cut -f1 || echo "?"))"
echo ""

# ===== Confirm =====
read -p "⚠️  This will OVERWRITE current DB at $DB_PATH. Proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# ===== Stop check =====
if pgrep -f "node.*server.js" > /dev/null; then
  echo "⚠️  Server đang chạy. Hãy STOP trước khi restore."
  echo "    docker compose down   # nếu dùng Docker"
  echo "    systemctl stop omniplug-cms   # nếu dùng systemd"
  read -p "Continue anyway? (yes/no): " force
  if [ "$force" != "yes" ]; then exit 1; fi
fi

# ===== Backup current trước khi overwrite =====
SAFETY="${DB_PATH}.before-restore-$(date +%s)"
if [ -f "$DB_PATH" ]; then
  echo "▸ Saving current DB to: $SAFETY"
  cp "$DB_PATH" "$SAFETY"
fi

# ===== Restore DB =====
echo "▸ Restoring DB → $DB_PATH"
mkdir -p "$(dirname "$DB_PATH")"
cp "$DB_BACKUP" "$DB_PATH"

# Also remove WAL/SHM files to avoid conflict
rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

# ===== Restore uploads =====
if [ -n "$UP_BACKUP" ]; then
  if [ ! -f "$UP_BACKUP" ]; then
    echo "✗ Uploads backup not found: $UP_BACKUP"
    exit 1
  fi
  echo "▸ Restoring uploads from: $UP_BACKUP"
  PARENT_DIR="$(dirname "$UPLOAD_DIR")"
  mkdir -p "$PARENT_DIR"
  # Move current to .old
  if [ -d "$UPLOAD_DIR" ]; then
    mv "$UPLOAD_DIR" "${UPLOAD_DIR}.before-restore-$(date +%s)"
  fi
  tar -xzf "$UP_BACKUP" -C "$PARENT_DIR"
fi

echo ""
echo "▸ Restore complete."
echo "  DB restored to:    $DB_PATH"
[ -f "$SAFETY" ] && echo "  Previous saved at: $SAFETY"
echo ""
echo "Next steps:"
echo "  1. Start server: docker compose up -d   (hoặc npm start)"
echo "  2. Verify: curl http://localhost:4000/health"
echo "  3. Login admin và kiểm tra content"
