#!/usr/bin/env bash
# scripts/check-no-secrets.sh
#
# Scans the repo (or a release ZIP) for accidentally committed secrets.
# Run before every release. Exit non-zero if any hit.
#
# Usage:
#   bash scripts/check-no-secrets.sh                  # scan repo working tree
#   bash scripts/check-no-secrets.sh path/to/dir      # scan an extracted ZIP
#
# What it catches:
#   - Real-looking API keys (LS, AWS, GitHub, Stripe)
#   - JWT-shaped tokens (eyJ...) longer than placeholder
#   - Private key headers
#   - .env files (not .env.example)
#   - Hardcoded common-password values left in production code
#
# What it deliberately allows:
#   - .env.example (placeholders only)
#   - keys/op-license-pub.pem (intentional — public verification key)
#   - keys/marcus-outdoor.qtd-license.txt (intentional — dev signed envelope)

set -uo pipefail
ROOT="${1:-.}"
HITS=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
yellow(){ printf '\033[33m%s\033[0m' "$1"; }

scan() {
  local label="$1" pattern="$2"
  shift 2
  local exclude_args=()
  for ex in "$@"; do exclude_args+=(--exclude-dir="$ex"); done
  local files
  files=$(grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude='*.zip' \
    "${exclude_args[@]}" -E "$pattern" "$ROOT" 2>/dev/null || true)
  if [ -n "$files" ]; then
    printf "  %s %s\n" "$(red ✗)" "$label"
    while read -r f; do
      [ -z "$f" ] && continue
      # Allow-list specific files
      case "$f" in
        *.env.example|*/keys/op-license-pub.pem|*/keys/*.qtd-license.txt|*/check-no-secrets.sh|*/security-smoke.sh|*/SECURITY_*.md|*/BUG_FIX_LOG.md|*/12_BUG_LOG.md|*/AUDIT_REPORT.md|*/INCIDENT_RESPONSE.md|*/SECURITY_THREAT_MODEL.md|*/CHANGELOG.md|*/.git/*|*/node_modules/*) continue ;;
      esac
      printf "       %s\n" "$f"
      HITS=$((HITS+1))
    done <<<"$files"
  else
    printf "  %s %s\n" "$(green ✓)" "$label"
  fi
}

echo "═══ Secret scan: $ROOT ═══"

# 1. Real .env files (not .env.example, not .env.local.example)
# When scanning working tree (.), only flag GIT-TRACKED .env (gitignored
# local .env is expected). When scanning a release dir, flag everything.
echo
echo "▸ Stray .env files:"
if [ "$ROOT" = "." ] && [ -d ".git" ]; then
  # Working tree mode — only worry about tracked .env
  ENV_FILES=$(git ls-files | grep -E '(^|/)\.env(\.production|\.local)?$' || true)
else
  ENV_FILES=$(find "$ROOT" -type f \( -name '.env' -o -name '.env.production' -o -name '.env.local' \) ! -path '*/node_modules/*' ! -path '*/.git/*' 2>/dev/null)
fi
if [ -n "$ENV_FILES" ]; then
  printf "  %s found tracked .env file(s) — must not ship:\n" "$(red ✗)"
  echo "$ENV_FILES" | sed 's/^/       /'
  HITS=$((HITS + $(echo "$ENV_FILES" | wc -l)))
else
  printf "  %s no stray .env files (local .env in dev is expected + gitignored)\n" "$(green ✓)"
fi

# 2. Private keys
echo
echo "▸ Private key material:"
scan "RSA/EC private key header found" "BEGIN (RSA |EC )?PRIVATE KEY"

# 3. Real-shaped LS API key (eyJ0... + length > 200 chars implies a real JWT, not placeholder)
echo
echo "▸ Lemon Squeezy API key shape:"
LS_HITS=$(grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude='*.zip' -E 'LEMONSQUEEZY_API_KEY\s*=\s*"?eyJ[A-Za-z0-9._-]{200,}' "$ROOT" 2>/dev/null || true)
if [ -n "$LS_HITS" ]; then
  printf "  %s real-looking LEMONSQUEEZY_API_KEY value:\n" "$(red ✗)"
  echo "$LS_HITS" | sed 's/^/       /'
  HITS=$((HITS+1))
else
  printf "  %s no real-looking LS API key\n" "$(green ✓)"
fi

# 4. AWS keys
echo
echo "▸ AWS keys:"
scan "AWS Access Key ID format AKIA..." 'AKIA[0-9A-Z]{16}'

# 5. GitHub tokens
echo
echo "▸ GitHub PAT format:"
scan "GitHub PAT (ghp_/gho_/github_pat_)" '(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}'

# 6. Stripe live keys
echo
echo "▸ Stripe live keys:"
scan "Stripe live key (sk_live_/pk_live_)" '(sk|pk)_live_[A-Za-z0-9]{20,}'

# 7. Webhook secrets that look real (whsec_ + content > 30 chars)
echo
echo "▸ Webhook secrets:"
WHSEC=$(grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude='*.zip' \
  --exclude='*.env.example' --exclude='*.md' --exclude='*.sh' \
  -E '(LEMONSQUEEZY_WEBHOOK_SECRET|WEBHOOK_SECRET)\s*=\s*"?(whsec|wsec)_[A-Za-z0-9]{20,}' "$ROOT" 2>/dev/null || true)
if [ -n "$WHSEC" ]; then
  printf "  %s real-looking webhook secret:\n" "$(red ✗)"
  echo "$WHSEC" | sed 's/^/       /'
  HITS=$((HITS+1))
else
  printf "  %s no real-looking webhook secret\n" "$(green ✓)"
fi

# 8. Admin default password leftover in production code (not in .env.example)
echo
echo "▸ Default admin password leak:"
DEFAULTS=$(grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude='*.zip' \
  --exclude='*.env.example' --exclude='*.md' --exclude='*.sh' \
  -E "ChangeMe123!" "$ROOT" 2>/dev/null \
  | grep -v '/scripts/check-no-secrets.sh' || true)
# Allowed in env.js (validates against this default), config doc files, README admin example
# Reject if found in OTHER source files
if [ -n "$DEFAULTS" ]; then
  REAL_LEAK=""
  while read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      # Legitimate dev/scaffold files: env validator, dev seed, dev docker, smoke
      # test, local .env (gitignored anyway), all docs.
      */env.js|*/migrate.js|*/seed.js|*/smoke.js|*/docker-compose.yml|*/.env|*/.env.example|*.md) continue ;;
      *) REAL_LEAK="$REAL_LEAK$f"$'\n' ;;
    esac
  done <<<"$DEFAULTS"
  if [ -n "$REAL_LEAK" ]; then
    printf "  %s 'ChangeMe123!' default password in unexpected file:\n" "$(red ✗)"
    echo "$REAL_LEAK" | sed 's/^/       /'
    HITS=$((HITS+1))
  else
    printf "  %s default password only in env.js + docs (expected)\n" "$(green ✓)"
  fi
else
  printf "  %s no ChangeMe123! literal\n" "$(green ✓)"
fi

# 9. Database files (SQLite) — same mode logic as .env above:
# only flag tracked DBs when scanning working tree
echo
echo "▸ Database files in tree:"
if [ "$ROOT" = "." ] && [ -d ".git" ]; then
  DB_FILES=$(git ls-files | grep -E '(^|/)(cms\.db|.*\.sqlite|.*\.db-wal|.*\.db-shm)$' || true)
else
  DB_FILES=$(find "$ROOT" -type f \( -name 'cms.db' -o -name '*.sqlite' -o -name '*.db-wal' -o -name '*.db-shm' \) ! -path '*/node_modules/*' ! -path '*/.git/*' 2>/dev/null)
fi
if [ -n "$DB_FILES" ]; then
  printf "  %s SQLite DB files found — must not ship:\n" "$(red ✗)"
  echo "$DB_FILES" | sed 's/^/       /'
  HITS=$((HITS+1))
else
  printf "  %s no tracked DB files (local data/ in dev is expected + gitignored)\n" "$(green ✓)"
fi

echo
echo "═══════════════════════════════════════════════════════════"
if [ "$HITS" -eq 0 ]; then
  printf "  %s no secrets / private keys / stray .env / DB files found\n" "$(green ✓)"
  echo "═══════════════════════════════════════════════════════════"
  exit 0
else
  printf "  %s %d hits — investigate before release\n" "$(red ✗)" "$HITS"
  echo "═══════════════════════════════════════════════════════════"
  exit 1
fi
