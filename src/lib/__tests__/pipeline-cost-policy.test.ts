import {expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
it('keeps free cycles free despite inherited flags; allows a single capped local AI pass on Tuesday and Friday',()=>{
 const dir=mkdtempSync(join(tmpdir(),'race-policy-'));
 try{
  const result=execFileSync('bash',['-c',`set -eu
export PIPELINE_POLICY_DIR="$1" PIPELINE_AI_MODE=free
export LLM_DAILY=1 LLM_CALENDARS=1 LLM_MONTHLY_BUDGET_USD=25
source "$2"
[ "$LLM_CALENDARS:$LLM_DAILY:$LLM_MONTHLY_BUDGET_USD:$CALENDAR_AI_BUDGET_USD" = 0:0:0:0 ]
DAY=2
date() { case "$*" in +%u) echo "$DAY" ;; +%G-%V) echo 2026-44 ;; *) command date "$@" ;; esac; }
export PIPELINE_AI_MODE=auto
source "$2"
[ "$PIPELINE_MODE:$LLM_DAILY_BUDGET_USD:$LLM_MONTHLY_BUDGET_USD" = ai:0.50:5.00 ]
source "$2"
[ "$PIPELINE_MODE:$CALENDAR_AI_BUDGET_USD" = free:0 ]
DAY=5
source "$2"
[ "$PIPELINE_MODE" = ai ]
echo PASS`,'test',dir,resolve('scripts/pipeline-mode.sh')],{encoding:'utf8'});
  expect(result).toContain('PASS');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
