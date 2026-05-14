#!/usr/bin/env bash
# Bundle src/index.ts → dist/index.js for npm distribution.
#
# We ship JS source + a `#!/usr/bin/env bun` shebang rather than a
# bun --compile binary (per the v0.2.0 distribution change, ADR-010
# follow-up). One npm package, ~few hundred KB; users install Bun
# themselves.
#
# The version is baked in via --define so `ikenga --version` reports
# the published number without an env var. Reads from package.json so
# `bun run build` after `npm version` always picks up the right number.

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"

mkdir -p dist
bun build ./src/index.ts \
  --outfile ./dist/index.js \
  --target bun \
  --format esm \
  --define "process.env.IKENGA_CLI_VERSION=\"$VERSION\""

chmod +x ./dist/index.js
echo "→ dist/index.js  (v$VERSION, $(wc -c < ./dist/index.js | awk '{print $1}') bytes)"
