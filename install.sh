#!/usr/bin/env bash
# Prefer:
#   npx daily-commit
#   npx daily-commit@latest -- my-dir
# Until published to npm:
#   npx github:HumfDev/daily-commit
set -euo pipefail
DIR="${1:-daily-commit}"
if npm view daily-commit version >/dev/null 2>&1; then
  echo "→ npx --yes daily-commit@latest -- ${DIR}"
  exec npx --yes daily-commit@latest -- "$DIR"
fi
echo "→ daily-commit not on npm yet; using GitHub"
echo "→ npx --yes github:HumfDev/daily-commit install ${DIR}"
exec npx --yes github:HumfDev/daily-commit install "$DIR"
