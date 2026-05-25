#!/usr/bin/env bash
# scripts/build-plugin-zip.sh
#
# Builds a clean quoted.zip for distribution.
# Excludes test fixtures, dev scripts, local configs, OS noise.
#
# Output: ./quoted.zip in repo root.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/wp-plugin"
OUT="$ROOT/quoted.zip"
STAGING="$(mktemp -d)/quoted"

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

if [ ! -d "$SRC" ]; then
  echo "$(red ✗) wp-plugin/ not found at $SRC"
  exit 1
fi

echo "═══ Build quoted.zip from $SRC ═══"
echo

# Stage plugin files
mkdir -p "$STAGING"
cp -R "$SRC"/. "$STAGING/"

# Strip dev-only files
echo "▸ Stripping dev/test files from staging:"
find "$STAGING" -type f \( \
  -name '.DS_Store' -o \
  -name '*.swp' -o \
  -name 'Thumbs.db' -o \
  -name '*.log' \
  \) -delete -print | sed 's/^/  removed /'

# Remove tests/ subdirectory — not for end customers
if [ -d "$STAGING/tests" ]; then
  rm -rf "$STAGING/tests"
  echo "  removed tests/ directory"
fi

# Lint each PHP file before zipping
echo
echo "▸ PHP lint check:"
LINT_FAIL=0
if command -v php >/dev/null 2>&1; then
  while IFS= read -r f; do
    if ! php -l "$f" >/dev/null 2>&1; then
      echo "  $(red ✗) syntax error: $f"
      LINT_FAIL=1
    fi
  done < <(find "$STAGING" -name '*.php')
  [ "$LINT_FAIL" -eq 0 ] && echo "  $(green ✓) all PHP files pass syntax check"
else
  echo "  (php not installed — skipping lint)"
fi
[ "$LINT_FAIL" -ne 0 ] && exit 1

# Run secret scan on staging
echo
echo "▸ Secret scan on staging:"
if bash "$ROOT/scripts/check-no-secrets.sh" "$STAGING" 2>&1 | tail -3 | grep -q "no secrets"; then
  echo "  $(green ✓) clean"
else
  echo "  $(red ✗) staged plugin has secret-like content — fix before release"
  exit 1
fi

# Build the ZIP
echo
echo "▸ Building ZIP:"
rm -f "$OUT"
(cd "$(dirname "$STAGING")" && zip -rq "$OUT" "$(basename "$STAGING")")
ls -lh "$OUT" | awk '{print "  size: " $5}'
echo "  files: $(unzip -l "$OUT" | tail -1 | awk '{print $2}')"

# Cleanup staging
rm -rf "$(dirname "$STAGING")"

# Verify ZIP installable layout (must have plugin main file at top-level)
PLUGIN_MAIN=$(unzip -l "$OUT" | awk '/quoted\.php/ {print $4; exit}')
if [ -z "$PLUGIN_MAIN" ]; then
  echo "  $(red ✗) ZIP missing quoted/quoted.php — would fail WordPress install"
  exit 1
fi
echo "  main file in ZIP: $PLUGIN_MAIN"

echo
echo "═══════════════════════════════════════════════════════════"
echo "  $(green ✓) built $OUT"
echo "═══════════════════════════════════════════════════════════"
echo
echo "Customer install path:"
echo "  WordPress admin → Plugins → Add New → Upload Plugin → choose quoted.zip"
