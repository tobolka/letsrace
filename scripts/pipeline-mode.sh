#!/bin/bash
# Free reads every cycle; optional AI passes on Tuesdays and Fridays, on this Mac.
PIPELINE_MODE="${PIPELINE_AI_MODE:-auto}"
PIPELINE_POLICY_DIR="${PIPELINE_POLICY_DIR:-$PWD/tmp/pipeline-policy}"
mkdir -p "$PIPELINE_POLICY_DIR"
if [ "$PIPELINE_MODE" = auto ]; then
  PIPELINE_WEEK=$(TZ=Europe/Prague date +%G-%V)
  PIPELINE_DAY=$(TZ=Europe/Prague date +%u)
  if { [ "$PIPELINE_DAY" = 2 ] || [ "$PIPELINE_DAY" = 5 ]; } && mkdir "$PIPELINE_POLICY_DIR/ai-$PIPELINE_WEEK-$PIPELINE_DAY" 2>/dev/null; then
    PIPELINE_MODE=ai
  else
    PIPELINE_MODE=free
  fi
fi
case "$PIPELINE_MODE" in
  free)
    export LLM_CALENDARS=0 LLM_DAILY=0 LLM_BUDGET_USD=0
    export LLM_DAILY_BUDGET_USD=0 LLM_MONTHLY_BUDGET_USD=0
    export CALENDAR_AI_BUDGET_USD=0 DUE_AI_BUDGET_USD=0
    ;;
  ai)
    export LLM_CALENDARS=1 LLM_DAILY=1
    export LLM_BUDGET_USD=0.50 LLM_DAILY_BUDGET_USD=0.50 LLM_MONTHLY_BUDGET_USD=5.00
    export CALENDAR_AI_BUDGET_USD=0.20 DUE_AI_BUDGET_USD=0.10
    ;;
  *) echo 'Invalid PIPELINE_AI_MODE: use auto, free or ai' >&2; return 1 ;;
esac
export BRAVE_SEARCH_LIMIT=0 DISCOVERY_SEASON="" PIPELINE_MODE
printf 'Pipeline mode: %s; daily model cap $%s; monthly model cap $%s; paid search off\n' "$PIPELINE_MODE" "$LLM_DAILY_BUDGET_USD" "$LLM_MONTHLY_BUDGET_USD"
