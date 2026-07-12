#!/usr/bin/env bash
# Remove daily-commit crontab entries for this install directory.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="$ROOT/dist/index.js run"

if ! crontab -l 2>/dev/null | grep -Fq "$MARKER"; then
  echo "• No cron entry found for $ROOT"
  exit 0
fi

crontab -l 2>/dev/null | grep -Fv "$MARKER" | crontab -
echo "✓ Removed cron entry for $ROOT"
