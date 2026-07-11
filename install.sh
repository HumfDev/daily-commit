#!/usr/bin/env bash
# Prefer:
#   npx install-daily-commit
#   npx install-daily-commit my-dir
set -euo pipefail
DIR="${1:-daily-commit}"
echo "→ npx --yes install-daily-commit ${DIR}"
exec npx --yes install-daily-commit "$DIR"
