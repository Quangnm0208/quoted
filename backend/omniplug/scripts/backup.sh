#!/bin/bash
# =====================================================================
# scripts/backup.sh — Daily backup cho OmniPlug CMS.
#
# Backup 2 thứ:
#   1. SQLite DB (dùng `.backup` command — safe khi DB đang được write)
#   2. uploads/ folder (tar.gz)
#
# Output:
#   ./backups/cms-YYYY-MM-DD-HHMM.db
#   ./backups/uploads-YYYY-MM-DD-HHMM.tar.gz
#
# Usage:
#   ./scripts/backup.sh                 # default paths
#   DB_PATH=/data/cms.db UPLOAD_DIR=/data/uploads ./scripts/backup.sh
#
# Cron (daily 02:00 AM):
#   0 2 * * * cd /app && ./scripts/backup.sh >> /var/log/cms-backup.log 2>&1
#
# Rotation: Giữ N ngày backup gần nhất, xóa cũ hơn.
#   BACKUP_RETENTION_DAYS=7 (default)
# =====================================================================

set -euo pipefail

# v1.2: verify sqlite3 CLI có sẵn (BLOCKER 4 fix)
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ sqlite3 CLI not found in PATH" >&2
  echo "  Local:  sudo apt-get install sqlite3   (Debian/Ubuntu)" >&2
  echo "          brew install sqlite             (macOS)" >&2
  echo "  Docker: Verify Dockerfile installs sqlite3 in runtime stage" >&2
  exit 2
fi

DB_PATH="${DB_PATH:-./data/cms.db}"
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

TS=$(date +%Y-%m-%d-%H%M)
DB_BACKUP="${BACKUP_DIR}/cms-${TS}.db"
UP_BACKUP="${BACKUP_DIR}/uploads-${TS}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "▸ Backup started: $(date)"

# ===== 1. SQLite backup =====
if [ ! -f "$DB_PATH" ]; then
  echo "✗ DB file not found at: $DB_PATH"
  exit 1
fi

echo "▸ Backing up DB: $DB_PATH → $DB_BACKUP"
sqlite3 "$DB_PATH" ".backup '$DB_BACKUP'"

# Verify backup readable
sqlite3 "$DB_BACKUP" "SELECT COUNT(*) FROM users;" > /dev/null
echo "  ✓ DB backup OK ($(du -h "$DB_BACKUP" | cut -f1))"

# ===== 2. Uploads backup =====
if [ -d "$UPLOAD_DIR" ]; then
  echo "▸ Backing up uploads: $UPLOAD_DIR → $UP_BACKUP"
  tar -czf "$UP_BACKUP" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "  ✓ Uploads backup OK ($(du -h "$UP_BACKUP" | cut -f1))"
else
  echo "⚠ Upload dir not found: $UPLOAD_DIR (skip)"
fi

# ===== 3. Rotation =====
echo "▸ Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "cms-*.db"          -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads-*.tar.gz"  -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null || true

echo "▸ Done: $(date)"
echo ""
echo "Available backups:"
ls -lh "$BACKUP_DIR"/cms-*.db 2>/dev/null | tail -10
