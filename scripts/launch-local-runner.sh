#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
# launchd has a minimal PATH. Use an existing managed Node 22+ installation.
NODE_BINARY="${LETSRACE_NODE_PATH:-}"
if [ ! -x "$NODE_BINARY" ]; then
  for candidate in "$HOME"/.nvm/versions/node/v22.*/bin/node; do
    if [ -x "$candidate" ]; then NODE_BINARY="$candidate"; fi
  done
fi
if [ ! -x "$NODE_BINARY" ]; then echo 'Node 22 runtime unavailable'; exit 1; fi
export PATH="$(dirname "$NODE_BINARY"):/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
exec "$NODE_BINARY" scripts/local-runner.cjs
