#!/bin/bash
# Keep the catalogue fresh from this Mac: a full refresh every few hours,
# the Mac kept awake while it runs. Stop with Ctrl+C.
#
#   bash scripts/keep-fresh.sh          # every 3 hours
#   bash scripts/keep-fresh.sh 2        # every 2 hours
#
# Each run is logged to tmp/refresh-<date>-<time>.log.
set -u
cd "$(dirname "$0")/.."
mkdir -p tmp
HOURS="${1:-3}"
while true; do
  LOG="tmp/refresh-$(date +%F-%H%M).log"
  echo "=== run started $(date '+%F %H:%M'), log: $LOG"
  caffeinate -i bash scripts/refresh-data.sh > "$LOG" 2>&1
  tail -22 "$LOG"
  echo "=== next run in ${HOURS} h ($(date -v+${HOURS}H '+%H:%M'))"
  sleep $((HOURS * 3600))
done
