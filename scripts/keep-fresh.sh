#!/bin/bash
# Keep the catalogue fresh from this Mac: a full refresh every few hours,
# the Mac kept awake while it runs. Stop with Ctrl+C.
#
# A run is about 15 minutes once the places are done, mostly the official
# calendars. Anything shorter than an hour mostly re-reads pages that have
# not changed (and the sources rate-limit), so an hour is the practical floor.
#
#   bash scripts/keep-fresh.sh          # every 2 hours
#   bash scripts/keep-fresh.sh 2        # every 2 hours
#   bash scripts/keep-fresh.sh --deep --hours=6  # bounded deep collection + refresh
#
# Each run is logged to tmp/refresh-<date>-<time>.log.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tmp
MANAGED_PID_FILE="$HOME/Library/Application Support/LetsRace/data/runner.pid"
if [ -r "$MANAGED_PID_FILE" ] && kill -0 "$(cat "$MANAGED_PID_FILE")" 2>/dev/null; then
  echo 'LetsRace už spravuje automatický sběrač. Použij ikonu kola v liště; druhá smyčka se nespustila.'
  exit 0
fi
HOURS=2
RUN_HOURS=0
for argument in "$@"; do
  case "$argument" in
    --deep) export SOURCE_DEEP=1 ;;
    --hours=*) RUN_HOURS="${argument#--hours=}" ;;
    --help) echo 'Usage: bash scripts/keep-fresh.sh [interval-hours] [--deep] [--hours=6]'; exit 0 ;;
    [0-9]*) HOURS="$argument" ;;
    *) echo "Unknown option: $argument" >&2; exit 1 ;;
  esac
done
if ! [[ "$HOURS" =~ ^[0-9]+$ && "$RUN_HOURS" =~ ^[0-9]+$ ]] || [ "$HOURS" -lt 1 ]; then
  echo 'Hours must be whole numbers; interval must be at least 1.' >&2; exit 1
fi
if [ "$RUN_HOURS" -gt 0 ]; then export SOURCE_RUN_DEADLINE=$(( $(date +%s) + RUN_HOURS * 3600 )); fi
# refresh-data.sh selects free/weekly-AI mode on every iteration. Existing
# loops pick up that policy without a restart. All model readers share a ledger.
export LLM_LEDGER_PATH="${LLM_LEDGER_PATH:-$PWD/tmp/llm-budget.json}"
export CATALOG_COUNTRIES="${CATALOG_COUNTRIES:-CZ,SK,AT,DE,PL,CH,IT}"
while true; do
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ] && [ "$(date +%s)" -ge "$SOURCE_RUN_DEADLINE" ]; then break; fi
  LOG="tmp/refresh-$(date +%F-%H%M).log"
  echo "=== run started $(date '+%F %H:%M'), log: $LOG"
  caffeinate -i bash scripts/refresh-data.sh 2>&1 | tee "$LOG"
  RESULT=${PIPESTATUS[0]}
  if [ "$RESULT" -eq 2 ]; then
    echo "Refresh finished with deferred work; details: $LOG"
  elif [ "$RESULT" -ne 0 ]; then
    echo "Refresh reported errors; details: $LOG"
  fi
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ]; then
    REMAINING=$((SOURCE_RUN_DEADLINE - $(date +%s)))
    if [ "$REMAINING" -le 0 ]; then break; fi
    if [ "$REMAINING" -lt $((HOURS * 3600)) ]; then break; fi
  fi
  echo "=== next run in ${HOURS} h ($(date -v+${HOURS}H '+%H:%M'))"
  sleep $((HOURS * 3600))
done
echo 'Finished. Data: tmp/source-dossiers/summary.json; completeness: tmp/data-goal-audit-latest.json'
