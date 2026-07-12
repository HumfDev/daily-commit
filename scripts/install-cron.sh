#!/usr/bin/env bash
# Install a local crontab entry for daily-commit.
#
# Usage:
#   bash scripts/install-cron.sh
#
# Requires: gh logged in (cron uses `gh auth token` for GH_TOKEN).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f dist/index.js ]; then
  echo "→ Building dist/ (required for cron)…"
  npm run build
fi

LOG="${DC_LOG:-$ROOT/daily-commit.log}"
MARKER="$ROOT/dist/index.js run"

if crontab -l 2>/dev/null | grep -Fq "$MARKER"; then
  echo "✓ Cron entry already installed for $ROOT"
  exit 0
fi

# Every 2 hours at :17 — scheduler gates inside the CLI (probability, quiet hours, etc.)
CRON_LINE="17 */2 * * * cd \"$ROOT\" && GH_TOKEN=\$(gh auth token) node \"$ROOT/dist/index.js\" run >> \"$LOG\" 2>&1"

( crontab -l 2>/dev/null || true; echo "$CRON_LINE" ) | crontab -

echo "✓ Installed crontab:"
echo "  $CRON_LINE"
echo "Log file: $LOG"
echo
echo "Verify:  crontab -l"
echo "Remove:  crontab -e   (delete the line above)"
