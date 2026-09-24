#!/bin/zsh
# Refresh the Czech federation calendar from this Mac.
#
# The portal is a Blazor app and needs a browser to render; Vercel has none,
# so this runs here, weekly, from launchd (see ~/Library/LaunchAgents/
# cz.letsrace.ingest-csc.plist). Output goes to ~/Library/Logs/letsrace-csc.log.
set -u
cd "$(dirname "$0")/.." || exit 1

# launchd starts with a bare PATH; find the nvm node this repo runs on.
NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/v22*/bin 2>/dev/null | tail -1)"
export PATH="${NODE_BIN}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
export LANG=cs_CZ.UTF-8

echo "=== $(date '+%Y-%m-%d %H:%M:%S') start (node $(node -v 2>/dev/null || echo missing))"
npx tsx scripts/ingest-calendars.ts portal.czechcyclingfederation.com/Races
exit_code=$?
echo "=== $(date '+%Y-%m-%d %H:%M:%S') done (exit $exit_code)"
exit "$exit_code"
