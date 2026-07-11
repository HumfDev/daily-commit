#!/usr/bin/env bash
# Prefer the npx / dc one-liner:
#
#   npx daily-commit
#   npx daily-commit my-dir
#   dc install
#
# This script forwards to the same flow for older docs/links.

set -euo pipefail

DIR="${1:-daily-commit}"
REPO="${DC_REPO:-HumfDev/daily-commit}"

echo "note: prefer \`npx daily-commit${1:+ $1}\` or \`dc install${1:+ $1}\` going forward."
echo "→ Falling back to: npx --yes github:${REPO} install ${DIR}"
exec npx --yes "github:${REPO}" install "$DIR"
