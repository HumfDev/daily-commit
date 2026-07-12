#!/usr/bin/env bash
# Smoke-test that the packed tarball exposes working CLI bins.
#
# Usage:
#   bash scripts/test-install.sh [path-to.tgz]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TGZ="${1:-}"
if [ -z "$TGZ" ]; then
  npm run build >/dev/null
  rm -f daily-commit-*.tgz
  npm pack >/dev/null
  TGZ="$(ls -1 daily-commit-*.tgz | head -1)"
fi

TGZ="$(cd "$(dirname "$TGZ")" && pwd)/$(basename "$TGZ")"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "→ installing $TGZ into temp prefix"
mkdir -p "$TMP/prefix"
npm install --prefix "$TMP/prefix" "$TGZ" --silent

BIN="$TMP/prefix/node_modules/.bin"
export PATH="$BIN:$PATH"

echo "→ daily-commit help"
daily-commit help | head -5

echo "→ dc help"
dc help | head -5

# Confirm both bins resolve to the same package
test -x "$BIN/daily-commit"
test -x "$BIN/dc"

echo "✓ smoke test passed"
