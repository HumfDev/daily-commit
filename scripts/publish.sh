#!/usr/bin/env bash
# Build, pack, and smoke-test create-daily-commit. Optionally upload to npm.
#
# Usage:
#   bash scripts/publish.sh              # build + pack + smoke test
#   bash scripts/publish.sh --upload     # also npm publish (needs auth / NPM_TOKEN)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UPLOAD=0
for arg in "$@"; do
  case "$arg" in
    --upload) UPLOAD=1 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

echo "→ npm ci (if needed) + build + test"
if [ ! -d node_modules ]; then
  npm ci
fi
npm run build
npm test

NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./package.json').version")"
TGZ="${NAME}-${VERSION}.tgz"

echo "→ npm pack"
rm -f "${NAME}"-*.tgz
npm pack

echo "→ smoke test packed wheel (tarball)"
bash scripts/test-install.sh "$ROOT/$TGZ"

if [ "$UPLOAD" -eq 1 ]; then
  echo "→ npm publish --access public"
  # Prefer NPM_TOKEN (CI / local export). Falls back to interactive npm login session.
  if [ -n "${NPM_TOKEN:-}" ]; then
    npm config set "//registry.npmjs.org/:_authToken" "$NPM_TOKEN"
  fi
  npm publish --access public
  echo "✓ Published ${NAME}@${VERSION} to npm"
else
  echo
  echo "✓ Built ${TGZ} (not uploaded)"
  echo "  Upload with:  NPM_TOKEN=… bash scripts/publish.sh --upload"
  echo "  Or:           npm publish --access public"
fi
