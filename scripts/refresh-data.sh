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
# All model readers share the same ledger, rather than resetting the cap per step.
export LLM_LEDGER_PATH="${LLM_LEDGER_PATH:-$PWD/tmp/llm-budget.json}"
export LLM_DAILY_BUDGET_USD="${LLM_DAILY_BUDGET_USD:-0.50}"
export LLM_MONTHLY_BUDGET_USD="${LLM_MONTHLY_BUDGET_USD:-5}"
export CATALOG_COUNTRIES="${CATALOG_COUNTRIES:-CZ,SK,AT,DE}"

step() {
  local title="$1"; shift
  echo
  echo "=== $title  ($(date '+%H:%M:%S'))"
  node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs "$@" || echo "!!! $title failed"
}

step "Coverage before"                     scripts/data-stats.ts
# Calendar fallbacks must leave room for completing already discovered races.
LLM_BUDGET_USD=0.08 step "Official calendars (force-poll)" scripts/reload-calendars.ts
LLM_BUDGET_USD=0.02 step "Everything else that is due" scripts/drain-due-watches.ts 40
if [ "${CATALOG_REVIEW_MERGES:-0}" = "1" ]; then
  step "Duplicates (review only)"          scripts/merge-duplicates.ts --dry
else
  step "Duplicates"                       scripts/merge-duplicates.ts
fi
step "Czech federation race pages"         scripts/fill-csc-ages.ts --apply
step "Austrian race pages"                 scripts/fill-cyclingaustria.ts --max=400 --apply
step "Race pages and regulations"          scripts/fill-regulation-ages.ts --max=1500 --apply
step "Entry links from race pages"         scripts/fill-registration-links.ts --max=1500 --apply
step "RaceResult, FCI, defaults"           scripts/fill-source-ages.ts
step "Confirmed series categories"         scripts/apply-series-ages.ts
step "Verified series documents, no model cost" scripts/enrich-series-documents.ts --max=500 --cached-only --apply
step "Italian organisers' websites"        scripts/fill-fci-websites.ts --max=600 --apply
step "Sportsoft race pages: entry, PDF"    scripts/fill-sportsoft-links.ts --apply
# The language model reads race pages once a day, within a small budget:
# new races, and ones not read for a month. Calendars it reads only when they
# change (inside the watch steps above, capped per process).
TODAY=$(date +%F)
# LLM_DAILY=1 turns it on (keep-fresh.sh sets it); every step has its own cap.
if [ "${LLM_DAILY:-0}" = "1" ] && { [ "${LLM_FORCE_DAILY:-0}" = "1" ] || [ "$(cat tmp/.llm-day 2>/dev/null)" != "$TODAY" ]; }; then
  # One season document can fill many rounds; give it first claim on the budget.
  LLM_BUDGET_USD=0.12 step "Shared series propositions and categories" scripts/enrich-series-documents.ts --max=500 --apply
  # Sites first (Brave search, a model only picks among the results), so the
  # reader below reads the new ones the same day.
  LLM_BUDGET_USD=0.1  step "Organisers' sites, searched"     scripts/research-races.ts --without-site --max=60 --apply
  LLM_BUDGET_USD=0.15 step "Race pages read by the model"   scripts/fill-llm-enrich.ts --max=200 --apply
  LLM_BUDGET_USD=0.1  step "Classes from each race's documents" scripts/fill-dossier-classes.ts --max=300 --render --apply
  LLM_BUDGET_USD=0.03 step "Races linked to their series"    scripts/link-series.ts --apply
  if [ "${CATALOG_REVIEW_MERGES:-0}" = "1" ]; then
    LLM_BUDGET_USD=0.1 step "Duplicates judged (review only)" scripts/judge-duplicates.ts --max=150
  else
    LLM_BUDGET_USD=0.1 step "Duplicates judged by the model" scripts/judge-duplicates.ts --max=150 --apply
  fi
  LLM_BUDGET_USD=0.1  step "Race or ride, new listings"       scripts/classify-event-kind.ts --since=3 --apply
  step "Italian races: rideandrest page"   scripts/fill-rideandrest-links.ts --apply
  echo "$TODAY" > tmp/.llm-day
fi
step "Last year's editions"                scripts/carry-forward-editions.ts --apply
step "Places (slow geocoding)"             scripts/geocode-slowly.ts 30
step "Coverage after"                      scripts/data-stats.ts
step "90 percent completeness by country"  scripts/audit-data-goal.ts
echo
echo "=== done $(date '+%H:%M:%S')"
