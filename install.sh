#!/usr/bin/env bash
# Prefer:
#   npm create daily-commit
#   npm create daily-commit@latest -- my-dir
# Until published to npm:
#   npx github:HumfDev/daily-commit
set -euo pipefail
DIR="${1:-daily-commit}"
if npm view create-daily-commit version >/dev/null 2>&1; then
  echo "→ npm create daily-commit@latest -- ${DIR}"
  exec npm create daily-commit@latest -- "$DIR"
fi
echo "→ create-daily-commit not on npm yet; using GitHub"
echo "→ npx --yes github:HumfDev/daily-commit install ${DIR}"
exec npx --yes github:HumfDev/daily-commit install "$DIR"
