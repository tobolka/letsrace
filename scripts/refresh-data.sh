#!/bin/bash
# Full data refresh, meant to run on a machine with Chrome.
#
#   bash scripts/refresh-data.sh 2>&1 | tee tmp/refresh-$(date +%F).log
#
# Official calendars first, then every per-race reader, then duplicates.
# Each step is its own process, so one failure does not stop the rest.
set -u
cd "$(dirname "$0")/.."
mkdir -p tmp

step() {
  local title="$1"; shift
  echo
  echo "=== $title  ($(date '+%H:%M:%S'))"
  node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs "$@" || echo "!!! $title failed"
}

step "Coverage before"                     scripts/data-stats.ts
step "Official calendars (force-poll)"     scripts/reload-calendars.ts
step "Everything else that is due"         scripts/drain-due-watches.ts 40
step "Duplicates"                          scripts/merge-duplicates.ts
step "Czech federation race pages"         scripts/fill-csc-ages.ts --apply
step "Austrian race pages"                 scripts/fill-cyclingaustria.ts --max=400 --apply
step "Race pages and regulations"          scripts/fill-regulation-ages.ts --max=1500 --apply
step "Entry links from race pages"         scripts/fill-registration-links.ts --max=1500 --apply
step "RaceResult, FCI, defaults"           scripts/fill-source-ages.ts
step "Italian organisers' websites"        scripts/fill-fci-websites.ts --max=600 --apply
step "Last year's editions"                scripts/carry-forward-editions.ts --apply
step "Confirmed series categories"         scripts/apply-series-ages.ts
step "Places (slow geocoding)"             scripts/geocode-slowly.ts 30
step "Coverage after"                      scripts/data-stats.ts
echo
echo "=== done $(date '+%H:%M:%S')"
