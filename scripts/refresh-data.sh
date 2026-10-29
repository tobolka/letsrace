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
TODAY=$(TZ=Europe/Prague date +%F)
source scripts/pipeline-mode.sh || exit 1
# All model readers share the same ledger, rather than resetting the cap per step.
export LLM_LEDGER_PATH="${LLM_LEDGER_PATH:-$PWD/tmp/llm-budget.json}"
export LLM_DAILY_BUDGET_USD="${LLM_DAILY_BUDGET_USD:-0.50}"
export LLM_MONTHLY_BUDGET_USD="${LLM_MONTHLY_BUDGET_USD:-5.00}"
export LLM_EXTRACTION_CACHE_DIR="${LLM_EXTRACTION_CACHE_DIR:-$PWD/tmp/extraction-cache}"
export CATALOG_COUNTRIES="${PIPELINE_TARGET_COUNTRIES:-CZ,SK,AT,DE,PL,CH,IT}"
# Requires the pipeline_candidate_review migration. Keep ambiguous writes reviewable.
export PIPELINE_REVIEW_QUEUE="${PIPELINE_REVIEW_QUEUE:-1}"
export CATALOG_OVERVIEW_ONLY="${CATALOG_OVERVIEW_ONLY:-1}"
export SOURCE_DOCUMENT_CACHE_DIR="${SOURCE_DOCUMENT_CACHE_DIR:-$PWD/tmp/source-documents}"
FAILURES=0
DEFERRED=0

step() {
  local title="$1"; shift
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ] && [ "$(date +%s)" -ge "$SOURCE_RUN_DEADLINE" ]; then echo "Time limit reached; pending: $title"; DEFERRED=$((DEFERRED + 1)); return 0; fi
  echo
  echo "=== $title  ($(date '+%H:%M:%S'))"
  local result=0
  node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs "$@" || result=$?
  if [ "$result" -eq 2 ]; then echo "... $title has deferred work"; DEFERRED=$((DEFERRED + 1));
  elif [ "$result" -ne 0 ]; then echo "!!! $title failed"; FAILURES=$((FAILURES + 1)); fi
}

# Resume individual daily steps: a failed or deadline-skipped step remains due.
# Successful steps are not charged again just because a later step failed.
daily_step() {
  local mode="review"
  case " $* " in *" --apply "*) mode="apply" ;; esac
  local stamp="tmp/.llm-steps/$(basename "$2" .ts)-$mode"
  if [ "${LLM_FORCE_DAILY:-0}" != "1" ] && [ "$(cat "$stamp" 2>/dev/null)" = "$TODAY" ]; then return 0; fi
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ] && [ "$(date +%s)" -ge "$SOURCE_RUN_DEADLINE" ]; then echo "Time limit reached; pending: $1"; DEFERRED=$((DEFERRED + 1)); return 0; fi
  local before="$FAILURES:$DEFERRED"
  step "$@"
  if [ "$FAILURES:$DEFERRED" = "$before" ]; then mkdir -p tmp/.llm-steps; echo "$TODAY" > "$stamp"; fi
}

# The old standalone launchd job could not read the moved Documents checkout.
# Run the same free Chrome reader from this already-authorized local loop.
weekly_browser_step() {
  if [ "$(TZ=Europe/Prague date +%u)" != 1 ] || [ "$(TZ=Europe/Prague date +%H)" -lt 9 ]; then return 0; fi
  local week=$(TZ=Europe/Prague date +%G-%V)
  local stamp="tmp/.browser-csc-week"
  if [ "$(cat "$stamp" 2>/dev/null)" = "$week" ]; then return 0; fi
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ] && [ "$(date +%s)" -ge "$SOURCE_RUN_DEADLINE" ]; then DEFERRED=$((DEFERRED + 1)); return 0; fi
  local failuresBefore="$FAILURES" deferredBefore="$DEFERRED" browserStatus="ok"
  LLM_BUDGET_USD=0 LLM_DAILY_BUDGET_USD=0 LLM_MONTHLY_BUDGET_USD=0 LLM_CALENDARS=0 step "Chrome: Czech federation calendar" scripts/ingest-calendars.ts portal.czechcyclingfederation.com/Races
  if [ "$FAILURES" -gt "$failuresBefore" ]; then browserStatus="failed";
  elif [ "$DEFERRED" -gt "$deferredBefore" ]; then browserStatus="needs_review"; fi
  printf '{"at":"%s","status":"%s","log":"current refresh log"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$browserStatus" > tmp/pipeline-browser-status.json
  # Preserve the partial/error result in the log; normal source polling handles
  # retries. Do not force another full Chrome calendar read every two hours.
  echo "$week" > "$stamp"
}

step "Coverage before"                     scripts/audit-catalogue-overview.ts
step "Structured calendars, no model or search cost" scripts/check-free-calendars.ts
weekly_browser_step
daily_step "Free discovery of new source links" scripts/explore-sources.ts
# Standalone discovery remains a manual tool; regular source finding is free.
# Calendar fallbacks must leave room for completing already discovered races.
LLM_BUDGET_USD="${CALENDAR_AI_BUDGET_USD:-1.25}" LLM_CALENDAR_BUDGET_USD="${CALENDAR_AI_BUDGET_USD:-1.25}" step "Due calendars and sources" scripts/reload-calendars.ts
LLM_BUDGET_USD="${DUE_AI_BUDGET_USD:-1.00}" LLM_CALENDAR_BUDGET_USD="${DUE_AI_BUDGET_USD:-1.00}" step "Everything else that is due" scripts/drain-due-watches.ts 40
if [ "${CATALOG_REVIEW_MERGES:-1}" = "1" ]; then
  step "Duplicates (review only)"          scripts/merge-duplicates.ts --dry
else
  step "Duplicates"                       scripts/merge-duplicates.ts
fi
if [ "${CATALOG_DETAIL_ENRICHMENT:-0}" = "1" ]; then
step "Czech federation race pages"         scripts/fill-csc-ages.ts --apply
step "Austrian race pages"                 scripts/fill-cyclingaustria.ts --max=400 --apply
step "Race pages and regulations"          scripts/fill-regulation-ages.ts --max=1500 --apply
step "RaceResult, FCI, defaults"           scripts/fill-source-ages.ts
step "Confirmed series categories"         scripts/apply-series-ages.ts
step "Verified series documents, no model cost" scripts/enrich-series-documents.ts --max=500 --cached-only --apply
fi
step "Entry links from race pages" scripts/fill-registration-links.ts --max=1500 --apply
step "Italian organisers' websites"        scripts/fill-fci-websites.ts --max=600 --apply
step "Sportsoft race pages: entry, PDF"    scripts/fill-sportsoft-links.ts --apply
if [ "${SOURCE_DEEP:-0}" = "1" ]; then
  DEEP_HOURS="${SOURCE_DEEP_HOURS:-4}"
  if [ "${SOURCE_RUN_DEADLINE:-0}" -gt 0 ]; then
    REMAINING=$((SOURCE_RUN_DEADLINE - $(date +%s)))
    if [ "$REMAINING" -gt 0 ]; then DEEP_HOURS=$(awk -v seconds="$REMAINING" -v cap="$DEEP_HOURS" 'BEGIN { printf "%.6f", (seconds < cap * 3600 ? seconds : cap * 3600) / 3600 }'); fi
  fi
  step "All countries: all-source documents, resumable local archive" scripts/collect-source-dossiers.ts --country=all --out=tmp/source-dossiers --render --hours="$DEEP_HOURS"
fi
# The language model reads race pages once a day, within a small budget:
# new races, and ones not read for a month. Calendars it reads only when they
# change (inside the watch steps above, capped per process).
TODAY=$(date +%F)
# LLM_DAILY=1 turns it on (keep-fresh.sh sets it); every step has its own cap.
if [ "${LLM_DAILY:-0}" = "1" ]; then
  # One season document can fill many rounds; give it first claim on the budget.
  if [ "${CATALOG_DETAIL_ENRICHMENT:-0}" = "1" ]; then
    LLM_BUDGET_USD=0.60 daily_step "Shared series propositions and categories" scripts/enrich-series-documents.ts --max=500 --apply
  fi
  # Preserve original admission classes when conversion to U bands is unsafe.
  if [ "${ORIGINAL_CATEGORY_IMPORT:-0}" = "1" ]; then
    LLM_BUDGET_USD=0.40 daily_step "Original categories, independently reviewed" scripts/refresh-original-categories.ts --max=20 --apply
  fi
  # Sites first (Brave search, a model only picks among the results), so the
  # reader below reads the new ones the same day.
  # Paid search stays disabled in the automatic low-cost policy.
  LLM_BUDGET_USD=0.75 daily_step "Race pages read by the model"   scripts/fill-llm-enrich.ts --max=200 --apply
  if [ "${CATALOG_DETAIL_ENRICHMENT:-0}" = "1" ]; then
    LLM_BUDGET_USD=0.50 daily_step "Classes from every source of each race" scripts/fill-dossier-classes.ts --max=300 --all-sources --dossier-dir=tmp/source-dossiers --render --apply
  fi
  LLM_BUDGET_USD=0.15 daily_step "Races linked to their series"    scripts/link-series.ts --apply
  if [ "${CATALOG_REVIEW_MERGES:-1}" = "1" ]; then
    LLM_BUDGET_USD=0.50 daily_step "Duplicates judged (review only)" scripts/judge-duplicates.ts --max=150
  else
    LLM_BUDGET_USD=0.50 daily_step "Duplicates judged by the model" scripts/judge-duplicates.ts --max=150 --apply
  fi
  LLM_BUDGET_USD=0.50 daily_step "Race or ride, new listings"       scripts/classify-event-kind.ts --since=3 --apply
  daily_step "Italian races: rideandrest page"   scripts/fill-rideandrest-links.ts --apply
fi
step "Last year's editions"                scripts/carry-forward-editions.ts --apply
step "Places (slow geocoding)"             scripts/geocode-slowly.ts 30
SOURCE_RUN_DEADLINE=0 step "Coverage after" scripts/audit-catalogue-overview.ts
if [ "${CATALOG_DETAIL_ENRICHMENT:-0}" = "1" ]; then
  SOURCE_RUN_DEADLINE=0 step "Detailed category diagnostics" scripts/audit-data-goal.ts
fi
echo
echo "=== done $(date '+%H:%M:%S')"
echo "=== failed steps: $FAILURES"
echo "=== deferred steps: $DEFERRED"
if [ "$FAILURES" -gt 0 ]; then exit 1; fi
if [ "$DEFERRED" -gt 0 ]; then exit 2; fi
