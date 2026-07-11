#!/usr/bin/env bash
# Prefer:
#   npm create daily-commit
#   npm create daily-commit@latest -- my-dir
set -euo pipefail
DIR="${1:-daily-commit}"
echo "→ npm create daily-commit@latest -- ${DIR}"
exec npm create daily-commit@latest -- "$DIR"
