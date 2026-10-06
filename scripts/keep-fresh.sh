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
# The model's daily work (a few cents a day, each step capped) and its reading
# of calendars no parser knows. Set to 0 to run without the model.
# Shared across every subprocess and refresh, including fallback calendar readers.
export LLM_LEDGER_PATH="${LLM_LEDGER_PATH:-$PWD/tmp/llm-budget.json}"
export LLM_DAILY_BUDGET_USD="${LLM_DAILY_BUDGET_USD:-0.50}"
export LLM_MONTHLY_BUDGET_USD="${LLM_MONTHLY_BUDGET_USD:-5}"
export CATALOG_COUNTRIES="${CATALOG_COUNTRIES:-CZ,SK,AT,DE}"
export BRAVE_SEARCH_LIMIT="${BRAVE_SEARCH_LIMIT:-40}"
export LLM_DAILY="${LLM_DAILY:-1}"
export LLM_CALENDARS="${LLM_CALENDARS:-1}"
while true; do
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ] && [ "$(date +%s)" -ge "$SOURCE_RUN_DEADLINE" ]; then break; fi
  LOG="tmp/refresh-$(date +%F-%H%M).log"
  echo "=== run started $(date '+%F %H:%M'), log: $LOG"
  if ! caffeinate -i bash scripts/refresh-data.sh 2>&1 | tee "$LOG"; then
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
