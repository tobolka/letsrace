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
#
# Each run is logged to tmp/refresh-<date>-<time>.log.
set -u
cd "$(dirname "$0")/.."
mkdir -p tmp
HOURS="${1:-2}"
# The model's daily work (a few cents a day, each step capped) and its reading
# of calendars no parser knows. Set to 0 to run without the model.
# Shared across every subprocess and refresh, including fallback calendar readers.
export LLM_LEDGER_PATH="${LLM_LEDGER_PATH:-$PWD/tmp/llm-budget.json}"
export LLM_DAILY_BUDGET_USD="${LLM_DAILY_BUDGET_USD:-0.50}"
export LLM_MONTHLY_BUDGET_USD="${LLM_MONTHLY_BUDGET_USD:-5}"
export BRAVE_SEARCH_LIMIT="${BRAVE_SEARCH_LIMIT:-40}"
export LLM_DAILY="${LLM_DAILY:-1}"
export LLM_CALENDARS="${LLM_CALENDARS:-1}"
while true; do
  LOG="tmp/refresh-$(date +%F-%H%M).log"
  echo "=== run started $(date '+%F %H:%M'), log: $LOG"
  caffeinate -i bash scripts/refresh-data.sh > "$LOG" 2>&1
  tail -22 "$LOG"
  echo "=== next run in ${HOURS} h ($(date -v+${HOURS}H '+%H:%M'))"
  sleep $((HOURS * 3600))
done
