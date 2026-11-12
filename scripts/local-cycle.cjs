/** One managed cycle: durable local work, then, only when it has something to offer, a fresh
 * target catalogue and the reviewed new races. No collector receives production credentials.
 * Existing-event edits stay in review. The working copy is never reset by this command; source
 * hashes and pending work survive. A cycle with nothing due does not touch the server at all.
 */
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const cp=require('node:child_process');
const {plan,assertReviewed}=require('./local-sync.cjs');
const {COPY,serverEnvironment}=require('./local-pull.cjs');
const {fillPlan}=require('./local-fills.cjs');
const {moreWorkLeft}=require('./local-schedule.cjs');
const BIN=process.env.LOCAL_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const data=process.env.LETSRACE_DATA_DIR||path.join(os.homedir(),'Library/Application Support/LetsRace/data');
const root=path.resolve(__dirname,'..');const env={...process.env,LC_ALL:'en_US.UTF-8',PGTZ:'UTC'};
const COUNTRIES='CZ,SK,DE,AT,PL,CH,IT';
const HOUR=3_600_000;
/** How stale the target copy may get while nothing here needs it: held races and operator locks. */
const TARGET_MAX_AGE_MS=12*HOUR;
/** New work may want the target sooner, but never a copy more than this often. */
const TARGET_MIN_GAP_MS=3*HOUR;
const NEW_RACES_PER_SEND=100;
/** Reading races' own sites for details, which the server used to do once a day. */
const SITE_DETAILS_EVERY_MS=6*HOUR;
const REGULATIONS_EVERY_MS=HOUR;
const GEOCODE_EVERY_MS=12*HOUR;
const SOURCE_HEALTH_EVERY_MS=7*24*HOUR;
/** Searching for sites of races that have none. A search is spaced about ten seconds apart. */
const WEBSITE_SEARCH_EVERY_MS=4*HOUR;
const ORGANISER_GAP_MS=HOUR/2;
const RESUME_PUBLISHING_EVERY_MS=6*HOUR;
/** Every filled race queues a public page check, of which the server does 60 a day. */
const FILLED_RACES_PER_CYCLE=30,FILLED_RACES_PER_DAY=150;
/** An operator's pause reaches the reader without a whole catalogue dump. */
const PAUSE_SYNC_MS=HOUR/2;
const ASSESS_AT_LEAST_EVERY_MS=24*HOUR;
/** How long a finished step's last lines may take to arrive. */
const OUTPUT_DRAIN_MS=2000;
/** Below this much of the day's or month's AI allowance, a step that needs AI is not started. */
const AI_STEP_NEEDS_USD=0.02;
const pragueDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
/** What is left of the shared AI allowance, by the same ledger and limits the readers use. */
function aiAllowanceLeft(ledger,now=new Date(),limits=process.env){
 const daily=Number(limits.LLM_DAILY_BUDGET_USD??0.5),monthly=Number(limits.LLM_MONTHLY_BUDGET_USD??5);
 const day=pragueDay(now),month=day.slice(0,7);const holds=Object.values(ledger?.holds??{});
 const held=key=>holds.filter(h=>h[key]===(key==='day'?day:month)).reduce((sum,h)=>sum+h.amount,0);
 return Math.min(daily-(ledger?.days?.[day]??0)-held('day'),monthly-(ledger?.months?.[month]??0)-held('month'));
}
/** The first moment of the next day in Prague, when the daily allowance is whole again. */
function nextPragueDay(now=Date.now()){
 const today=pragueDay(new Date(now));let at=now;
 for(let step=HOUR;step>=1000;step=Math.floor(step/2)){while(pragueDay(new Date(at+step))===today)at+=step;}
 return at+1000;
}
const json=(file,fallback=null)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const atomic=(file,value)=>{const p=`${file}.${process.pid}.tmp`;fs.writeFileSync(p,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(p,file);};
const sql=(db,query)=>cp.execFileSync(`${BIN}/psql`,['-h','127.0.0.1','-p','54329','-U','postgres','-d',db,'-qAt','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',maxBuffer:2**29,env:{...env,NODE_OPTIONS:''}});
let interrupted=false;
function acquireLock(file){
 try{fs.writeFileSync(file,JSON.stringify({pid:process.pid,at:new Date().toISOString()}),{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw e;const old=json(file);if(!old?.pid)throw Error('Nečitelný zámek místního běhu');let alive=true;try{process.kill(old.pid,0);}catch(x){if(x.code==='ESRCH')alive=false;else throw x;}if(alive)throw Error('Místní průchod už běží');fs.unlinkSync(file);return acquireLock(file);}
 return ()=>{if(json(file)?.pid===process.pid)fs.unlinkSync(file);};
}
function run(command,args,{allowedCodes=[0],timeout=120000,extraEnv={}}={}){
 return new Promise((resolve,reject)=>{
  if(interrupted)return reject(Error('Běh byl zastaven; uložená práce zůstává na příště'));
  const child=cp.spawn(command,args,{cwd:root,env:{...env,...extraEnv},stdio:['ignore','pipe','pipe']});let output='';let timedOut=false;
  let killTimer;const stop=()=>{child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),15000);killTimer.unref();};
  const timer=setTimeout(()=>{timedOut=true;stop();},timeout);const abort=()=>{interrupted=true;stop();};process.once('SIGTERM',abort);process.once('SIGINT',abort);
  child.stdout.on('data',b=>{process.stdout.write(b);output=(output+b).slice(-(2**22));});child.stderr.on('data',b=>process.stderr.write(b));
  // The step is over when its process is. Waiting for its output to close as well let a
  // forgotten descendant hold a finished step, and the whole cycle, until that one gave up.
  let settled=false;const settle=(code,signal)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(killTimer);process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);child.stdout.destroy();child.stderr.destroy();if(!interrupted&&!timedOut&&!signal&&allowedCodes.includes(code))resolve({code,output});else reject(Object.assign(Error(`${path.basename(args.find(a=>/^scripts\//.test(a))||args[0]||command)}: ${interrupted?'běh zastaven':timedOut?'časový limit':signal||code}`),{code,timedOut,output}));};
  child.once('error',reject);child.once('close',settle);child.once('exit',(code,signal)=>{const drain=setTimeout(()=>settle(code,signal),OUTPUT_DRAIN_MS);drain.unref();});
 });
}
/** What a step may say about itself on a line `step_outcome {"outcome":…,"reason":…}`. */
const STEP_OUTCOMES=['done','partial','timeout','blocked','waiting','failed'];
/**
 * How one upkeep step ended. Exit 2 used to read "deferred" whether the step stopped at its own
 * budget with its work saved, or was cut off by the time limit around it; those are different.
 * done: finished. partial: stopped at its own budget, the rest waits. timeout: cut off from
 * outside. blocked: the other side keeps us out (a robot check, a sign-in), nothing here is
 * broken. waiting: the AI allowance is spent. failed: anything else.
 */
function stepOutcome({code=null,timedOut=false,output=''}={}){
 const lines=String(output).split('\n').filter(line=>line.startsWith('step_outcome '));
 if(lines.length){try{const said=JSON.parse(lines.at(-1).slice(13));if(STEP_OUTCOMES.includes(said.outcome))return {outcome:said.outcome,reason:String(said.reason??said.outcome).slice(0,40)};}catch{/* An unreadable line says nothing. */}}
 if(timedOut||/(?:^|\n)pipeline_step_deferred /.test(output))return {outcome:'timeout',reason:'timeout'};
 if(code===0)return {outcome:'done',reason:null};
 if(code===2)return {outcome:'partial',reason:'own_time_budget'};
 return {outcome:'failed',reason:`exit_${code??'unknown'}`};
}
/** How long a step that keeps failing waits before its next try; the fifth and later wait a week. */
const FAILURE_DELAYS_MS=[HOUR,6*HOUR,24*HOUR,3*24*HOUR,7*24*HOUR];
const STOP_AFTER_FAILURES=FAILURE_DELAYS_MS.length;
/**
 * A step cut off by its time limit after the Mac slept through part of it did not fail: the
 * clock on the wall ran on while the step, and the timer that ends it, stood still.
 */
const sleptThrough=(elapsedMs,limitMs)=>elapsedMs>limitMs+2*60_000;
/**
 * What is remembered about a step, or a group of steps reading one website, after an attempt.
 * Only a real failure counts: a step that failed, or one cut off by its limit while the Mac was
 * awake. Kept out by the other side waits the step's usual interval and counts nothing. A spent
 * AI allowance and a slept-through limit change nothing. Finished work forgets everything.
 */
function holdAfter(hold,ended,{now=Date.now(),every=24*HOUR,slept=false,step=null}={}){
 if(ended.outcome==='done'||ended.outcome==='partial')return null;
 const steps=[...new Set([...(hold?.steps??[]),...(step?[step]:[])])];
 if(ended.outcome==='blocked')return {...hold,steps,outcome:'blocked',reason:ended.reason,failures:hold?.failures??0,since:hold?.outcome==='blocked'?hold.since:new Date(now).toISOString(),nextTryAt:new Date(now+every).toISOString()};
 if(ended.outcome==='failed'||(ended.outcome==='timeout'&&!slept)){
  const failures=(hold?.failures??0)+1;
  return {steps,outcome:ended.outcome,reason:ended.reason,failures,stopped:failures>=STOP_AFTER_FAILURES,since:hold?.failures?hold.since:new Date(now).toISOString(),nextTryAt:new Date(now+FAILURE_DELAYS_MS[Math.min(failures,STOP_AFTER_FAILURES)-1]).toISOString()};
 }
 return hold??null;
}
const heldNow=(hold,now=Date.now())=>Boolean(hold?.nextTryAt)&&Date.parse(hold.nextTryAt)>now;
/** The past season whose next editions are looked for; see src/lib/catalog/edition-season.ts. */
function editionSeason(now=new Date()){
 const part=type=>Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'numeric'}).formatToParts(now).find(p=>p.type===type)?.value);
 return part('month')>=10?part('year'):part('year')-1;
}
/** Does the organiser reading have anything to do, by what it saved last time? */
function organiserDue(coverage,now=Date.now(),lastPass=null){
 if(!coverage||coverage.unreadPages==null||coverage.unreadPages>0)return true;
 // Pages fall due one at a time: wait and read them together, not a whole cycle for each.
 if(lastPass&&now-Date.parse(lastPass)<ORGANISER_GAP_MS)return false;
 return Boolean(coverage.nextDueAt)&&Date.parse(coverage.nextDueAt)<=now;
}
/** Is a look at the target needed now? Each reason is one that sending could actually act on. */
function targetWanted(state,eventsNow,now=Date.now()){
 if(!state.targetCheckedAt||state.sendFailed||state.deferredNewRaces>0||state.fillsWaiting>0)return true;
 if(state.eventsAtLastPlan!==eventsNow)return true;
 return now-Date.parse(state.targetCheckedAt)>=TARGET_MAX_AGE_MS;
}
function targetNeeded(state,eventsNow,now=Date.now()){
 if(!targetWanted(state,eventsNow,now))return false;
 return !state.targetCheckedAt||now-Date.parse(state.targetCheckedAt)>=TARGET_MIN_GAP_MS;
}
const dueEvery=(at,every,now=Date.now())=>!at||now-Date.parse(at)>=every;
function syncPauses(state){
 const disabled=cp.execFileSync(`${BIN}/psql`,['-qAt','-v','ON_ERROR_STOP=1','-c',"select coalesce(json_agg(id),'[]') from public.watched_urls where status<>'active'"],{encoding:'utf8',timeout:30_000,maxBuffer:2**26,env:{...serverEnvironment(),NODE_OPTIONS:''}});
 applyPauses(JSON.parse(disabled));state.pausesSyncedAt=new Date().toISOString();
}
/** Regulations links the gate accepted on the server since the last look, written into empty fields of the copy here. */
function pullAccepted(state){
 const since=/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(state.acceptedPulledAt??'')?state.acceptedPulledAt:'2026-11-11T00:00:00.000Z';
 const now=new Date().toISOString();
 const rows=JSON.parse(cp.execFileSync(`${BIN}/psql`,['-qAt','-v','ON_ERROR_STOP=1','-c',`select coalesce(json_agg(json_build_object('id',event_id,'url',value#>>'{}')),'[]') from public.pipeline_proposals where status='applied' and field='regulations_url' and decided_at>='${since}'`],{encoding:'utf8',timeout:30_000,maxBuffer:2**26,env:{...serverEnvironment(),NODE_OPTIONS:''}}));
 let filled=0;
 for(const row of rows){
  if(!/^[-a-f0-9]{36}$/.test(row.id)||!/^https?:\/\/\S+$/.test(row.url??''))continue;
  filled+=Number(sql('letsrace',`with done as (update public.events set regulations_url='${row.url.replace(/'/g,"''")}' where id='${row.id}'::uuid and regulations_url is null returning 1) select count(*) from done`).trim());
 }
 state.acceptedPulledAt=now;return filled;
}
function applyPauses(ids){
 const valid=ids.filter(id=>/^[-a-f0-9]{36}$/.test(id));
 if(valid.length)sql('letsrace',`update public.watched_urls set status='paused' where status='active' and id in (${valid.map(id=>`'${id}'::uuid`).join(',')})`);
}
/** How many of last year's races have their next edition, by country, with one reading a day kept. */
function coverageFrom(status,reviews){
 const country=new Map(reviews.map(r=>[r.id,r.location?.country_code??'?']));const byCountry={};
 for(const row of status.rows){const c=country.get(row.race)??'?';const held=byCountry[c]??={races:0,withEdition:0};held.races++;if(row.state==='found'||row.state==='published')held.withEdition++;}
 const races=status.rows.length,withEdition=Object.values(byCountry).reduce((sum,c)=>sum+c.withEdition,0);
 return {season:status.summary.season,races,withEdition,byCountry};
}
function writeCoverage(archive,directory){
 const status=json(path.join(archive,'edition-status.json'));const reviews=json(path.join(archive,'replay','race-review.json'));
 if(!status||!reviews)return null;
 const now=coverageFrom(status,reviews),file=path.join(directory,'edition-coverage.json');const old=json(file,{history:[]});
 const day=new Date().toISOString().slice(0,10);
 const history=[...old.history.filter(h=>h.day!==day),{day,races:now.races,withEdition:now.withEdition}].slice(-120);
 const result={at:new Date().toISOString(),...now,history};atomic(file,result);
 return {season:now.season,races:now.races,withEdition:now.withEdition};
}
async function main(){
 fs.mkdirSync(data,{recursive:true,mode:0o700});const release=acquireLock(path.join(data,'local-cycle.lock'));
 const started=Date.now(),runId=new Date().toISOString().replace(/[:.]/g,'-'),directory=path.join(data,'local-cycles',runId);fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const report={version:2,id:runId,startedAt:new Date().toISOString(),state:'running',stage:'Příprava',publishedNewRaces:0,updatedRaces:0,heldRaces:0,readSources:0,readAttempts:0,localDatabaseRequests:0,publicChecks:[],sourceFailures:0,aiCostUsd:0,deferredNewRaces:0,problems:[],targetRead:false,moreWork:false,nextWorkAt:null};
 const save=()=>{atomic(path.join(directory,'result.json'),report);atomic(path.join(data,'local-cycle-latest.json'),report);};
 const stage=text=>{report.stage=text;save();console.log(`=== ${text} (${new Date().toISOString()})`);};
 const node=(file,args=[],options)=>run(process.execPath,['scripts/with-node.cjs',file,...args],options);
 const local=(args,options)=>run('/bin/bash',['scripts/local-run.sh',process.execPath,...args],options);
 const stateFile=path.join(data,'local-cycle-state.json');const state=json(stateFile,{});const saveState=()=>atomic(stateFile,state);
 const season=editionSeason(),archive=path.join(data,`organiser-check-${season+1}`);const organiser={read:0,attempted:0,proposed:0,published:0,deferred:false};report.organiser=organiser;
 let remote,failed=null;
 const note=e=>{failed??=e.message;console.error(`!!! ${e.message}`);};
 try{
  stage('Zjišťuji, co je potřeba udělat');
  await run('/bin/bash',['scripts/local-db.sh','start']);
  if(sql('postgres',"select count(*) from pg_database where datname in ('letsrace','letsrace_baseline')").trim()!=='2')throw Error('Chybí první připravená místní kopie katalogu');
  const dueNow="select count(*) from public.watched_urls where status='active' and next_poll_at<=now() and url not ilike '%portal.czechcyclingfederation.com/Races%'";
  const due=Number(sql('letsrace',dueNow).trim());report.dueSources=due;

  // Part 1: reading, all of it here. Nothing below needs the server.
  if(due>0){
   // An operator's source pause on the server must also stop this collector.
   if(!state.pausesSyncedAt||Date.now()-Date.parse(state.pausesSyncedAt)>=PAUSE_SYNC_MS){
    try{syncPauses(state);saveState();}catch(e){console.warn(`Stav pozastavení zdrojů nezjištěn: ${String(e.message).split('\n')[0].slice(0,160)}`);}
   }
   stage('Čtu splatné zdroje na Macu');
   // 2 is a stopped or time-limited pass. Anything else means the reader itself did not work,
   // which must never read as "nothing was due".
   try{
    await local(['scripts/local-parallel.cjs','--workers=4','--limit=24','--seconds=90','--max-minutes=15'],{allowedCodes:[0,2],timeout:17*60_000});
    const sourceReport=path.join(directory,'sources.json');await node('./node_modules/tsx/dist/cli.mjs',['scripts/local-report.ts',`--out=${sourceReport}`,`--since=${report.startedAt}`]);
    report.sourceReport=sourceReport;
    const summary=json(sourceReport);report.readSources=summary.overall.sourcesRead;report.sourceFailures=summary.overall.failed;report.unreadableSources=summary.overall.unreadable;report.deferredSources=summary.overall.deferred;report.unfinishedSources=summary.overall.unfinished;report.problems=summary.problems;
    const attempts=JSON.parse(sql('letsrace', `select json_build_object('reads',count(*),'databaseRequests',coalesce(sum((metrics#>>'{database,attempts}')::int),0)) from public.ingest_runs where started_at >= '${report.startedAt}'`));
    report.readAttempts=attempts.reads;report.localDatabaseRequests=attempts.databaseRequests;
   }catch(e){if(interrupted)throw e;note(e);}
  }
  save();

  // Part 2: organisers' own websites, for the coming season's announced dates.
  const ledger=path.join(archive,'pages.jsonl');const ledgerSize=()=>{try{return fs.statSync(ledger).size;}catch{return 0;}};
  const sizeBefore=ledgerSize();const coverageBefore=json(path.join(archive,'coverage.json'));
  if(organiserDue(coverageBefore,Date.now(),state.organiserPassAt)){
   stage('Čtu weby pořadatelů');state.organiserPassAt=new Date().toISOString();saveState();
   try{
    const bounded=['scripts/bounded-pipeline-step.cjs','600',process.execPath,'scripts/with-node.cjs','./node_modules/tsx/dist/cli.mjs','scripts/audit-next-edition-websites.ts',String(season),`--countries=${COUNTRIES}`,`--out=${archive}`,'--seconds=480','--limit=250'];
    await local(bounded,{allowedCodes:[0,2],timeout:11*60_000});
   }catch(e){if(interrupted)throw e;note(e);}
  }
  const sizeNow=ledgerSize();const coverage=json(path.join(archive,'coverage.json'));organiser.read=sizeNow>sizeBefore?Math.max(1,(coverage?.attemptedPages??0)-(coverageBefore?.attemptedPages??0)):0;organiser.unread=coverage?.unreadPages??null;organiser.nextDueAt=coverage?.nextDueAt??null;
  // Judged from the saved text. What passes goes to the local copy as a new reviewed race;
  // only the step below may send it anywhere.
  if(sizeNow>0&&(sizeNow!==state.assessedLedgerSize||state.assessmentDeferred||!state.assessedAt||Date.now()-Date.parse(state.assessedAt)>=ASSESS_AT_LEAST_EVERY_MS)){
   stage('Posuzuji termíny z webů pořadatelů');
   try{
    await node('./node_modules/tsx/dist/cli.mjs',['scripts/audit-next-edition-websites.ts',`--replay=${archive}`],{timeout:5*60_000});
    const assessed=await local(['scripts/with-node.cjs','./node_modules/tsx/dist/cli.mjs','scripts/check-next-editions.ts',`--season=${season}`,`--archive=${archive}`,`--countries=${COUNTRIES}`,'--literal','--apply','--max-apply=30','--seconds=240',...(fs.existsSync(path.join(archive,'reviewed-answers.json'))?[`--answers=${path.join(archive,'reviewed-answers.json')}`]:[])],{allowedCodes:[0,2],timeout:8*60_000});
    const line=assessed.output.split('\n').find(text=>text.startsWith('organiser_assessment '));
    const summary=line?JSON.parse(line.slice(21)):null;
    if(summary){organiser.assessment=summary;organiser.published=summary.counts?.published??0;organiser.deferred=summary.status==='deferred';organiser.attempted=organiser.published+(summary.waiting?.publish_failed??0);organiser.proposed=summary.waiting?.pass_limit??0;}
    state.assessedLedgerSize=sizeNow;state.assessedAt=new Date().toISOString();state.assessmentDeferred=organiser.deferred;saveState();
   }catch(e){if(interrupted)throw e;note(e);}
  }
  try{report.coverage=writeCoverage(archive,data);}catch(e){console.warn(`Pokrytí nespočítáno: ${e.message}`);}
  save();

  // Part 3: the rest of the upkeep that only needs other people's websites and the copy here.
  const tsx='./node_modules/tsx/dist/cli.mjs';
  const ledgerFile=path.join(data,'llm-budget.json');let aiWaiting=false;
  // Steps reading one website share one hold: when the site is shut, neither of them asks again.
  const GROUPS={radNet:'rad-net.de',radNetNew:'rad-net.de'};
  // `server` steps hold the database access and start their own keyless readers; they run outside the local copy's wrapper.
  const upkeep=async(name,key,every,text,args,seconds,extraEnv={},server=false)=>{
   const launch=server?(list,options)=>run(process.execPath,list,options):local;
   const group=GROUPS[name]??name;
   // Waiting after a failure, or for a website that keeps us out. Not an attempt, so nothing is recorded.
   if(heldNow(state.stepHolds?.[group])){report.heldSteps=(report.heldSteps??0)+1;return;}
   // After a failure the hold decides when to try again, not the step's usual interval.
   if(!state.stepHolds?.[group]?.failures&&!dueEvery(state[key],every))return;
   const began=Date.now();
   const remember=(ended,slept=false)=>{
    const hold=holdAfter(state.stepHolds?.[group],ended,{every,slept,step:name});state.stepHolds??={};
    if(hold)state.stepHolds[group]=hold;else delete state.stepHolds[group];saveState();
    return {...ended,...(slept?{slept:true}:{}),...(hold&&hold.outcome===ended.outcome?{failures:hold.failures,nextTryAt:hold.nextTryAt,...(hold.stopped?{stopped:true}:{})}:{})};
   };
   if(extraEnv.LOCAL_ALLOW_AI==='1'&&aiAllowanceLeft(json(ledgerFile,{}))<AI_STEP_NEEDS_USD){aiWaiting=true;(report.upkeep??={})[name]='waiting: AI allowance spent';(report.steps??={})[name]={outcome:'waiting',reason:'ai_budget'};return;}
   stage(text);
   try{
    const done=await launch(['scripts/bounded-pipeline-step.cjs',String(seconds),process.execPath,'scripts/with-node.cjs',tsx,...args],{allowedCodes:[0,2],timeout:(seconds+60)*1000,extraEnv});
    const ended=remember(stepOutcome(done),sleptThrough(Date.now()-began,seconds*1000));(report.steps??={})[name]=ended;
    state[key]=new Date().toISOString();saveState();(report.upkeep??={})[name]=ended.outcome==='done'?'done':ended.outcome==='partial'?'deferred':ended.outcome;
    if(ended.outcome==='timeout'&&!ended.slept)(report.failedUpkeep??=[]).push(name);
   }catch(e){
    if(interrupted)throw e;
    // The allowance can run out in the middle of a step. What it saved stays; the rest waits.
    if(extraEnv.LOCAL_ALLOW_AI==='1'&&aiAllowanceLeft(json(ledgerFile,{}))<AI_STEP_NEEDS_USD){aiWaiting=true;(report.upkeep??={})[name]='waiting: AI allowance spent';(report.steps??={})[name]={outcome:'waiting',reason:'ai_budget'};return;}
    const ended=remember(stepOutcome(e),sleptThrough(Date.now()-began,(seconds+60)*1000));(report.steps??={})[name]=ended;
    // Kept out by the other side: nothing here failed, and asking again every cycle changes nothing.
    // The step, and any other reading the same website, waits its usual interval.
    if(ended.outcome==='blocked'){state[key]=new Date().toISOString();saveState();(report.upkeep??={})[name]=`blocked: ${ended.reason}`;(report.blockedUpkeep??=[]).push(name);console.warn(`Údržba ${name} čeká: ${ended.reason}`);return;}
    if(ended.slept){(report.upkeep??={})[name]='timeout: the Mac slept';console.warn(`Údržba ${name}: čas vypršel během spánku Macu`);return;}
    (report.upkeep??={})[name]=`failed: ${e.message}`;(report.failedUpkeep??=[]).push(name);console.warn(`Údržba ${name} se nepovedla: ${e.message}${ended.stopped?'; krok je zastavený a zkusí se za týden':''}`);
   }
  };
  // Races whose day has passed are completed in the copy here as the server completes its own. Without this the
  // copy kept them "scheduled" and every cycle held about a hundred "completed → scheduled" changes for review
  // that were only the copy being behind (97 on 11 Nov 2026, 95 of them races already ridden).
  await upkeep('completePast','completePastAt',12*HOUR,'Uzavírám proběhlé závody v kopii',['scripts/complete-past.ts'],300);
  // Publications stopped halfway, already approved. Without this a race stays half-published for good.
  await upkeep('resumePublishing','resumePublishingAt',RESUME_PUBLISHING_EVERY_MS,'Dokončuji přerušená zveřejnění',['scripts/review-discovery-candidates.ts','--resume','--apply'],120);
  await upkeep('siteDetails','siteDetailsAt',SITE_DETAILS_EVERY_MS,'Doplňuji údaje z webů závodů',['scripts/local-catalog-fills.ts'],480);
  // Finding comes before reading: neither needs search or AI, and what they find the next step reads.
  await upkeep('calendarDocuments','calendarDocumentsAt',7*24*HOUR,'Hledám propozice v kalendářích',['scripts/harvest-calendar-documents.ts','--apply','--seconds=480'],540);
  // Version 2, first lane: one queue task per site, read without keys, handed in as proposals and decided by
  // the gate on the server. It replaces harvest-site-documents.ts writing to the copy here. LOCAL_SITE_DOCUMENTS=1 brings the old step back.
  if(process.env.LOCAL_SITE_DOCUMENTS==='1')await upkeep('siteDocuments','siteDocumentsAt',24*HOUR,'Hledám propozice na webech závodů',['scripts/harvest-site-documents.ts','--apply','--seconds=480'],540);
  else await upkeep('findDocuments','findDocumentsAt',24*HOUR,'Hledám propozice na webech závodů (fronta a brána)',['scripts/pipeline2-find-documents.ts','--server','--sites=80',`--out=${path.join(directory,'find-documents.json')}`],1500,{},true);
  await upkeep('signups','signupsAt',24*HOUR,'Čtu přihlašovací portály',['scripts/harvest-signups.ts','--apply'],300);
  await upkeep('winspace','winspaceAt',24*HOUR,'Čtu pořadatele českých závodů z kalendáře',['scripts/harvest-winspace.ts','--apply','--seconds=300'],360);
  await upkeep('pzkol','pzkolAt',24*HOUR,'Čtu polské závody ze stránek federace',['scripts/harvest-pzkol.ts','--apply','--seconds=300'],360);
  await upkeep('federciclismo','federciclismoAt',24*HOUR,'Čtu italské závody ze stránek federace',['scripts/harvest-federciclismo.ts','--apply','--seconds=480',`--date-report=${path.join(data,'federation-date-differences.json')}`],540);
  await upkeep('radNetNew','radNetNewAt',24*HOUR,'Přidávám chybějící vypsané německé závody',['scripts/radnet-new-races.ts','--apply','--skip=3 Rosen Cross,Meisterschaft der Nordverbände'],360);
  await upkeep('radNet','radNetAt',24*HOUR,'Čtu německé závody z rad-net',['scripts/harvest-radnet.ts','--apply'],540);
  // The one step allowed the AI key, and only within the shared limits the step itself enforces.
  await upkeep('regulations','regulationsAt',REGULATIONS_EVERY_MS,'Čtu propozice a doplňuji údaje o závodech',['scripts/enrich-practical-details.ts','--apply','--max=40','--minutes=12','--tolerate-unreadable',`--search-ledger=${path.join(data,'search-budget.json')}`],780,{LOCAL_ALLOW_AI:'1',BRAVE_SEARCH_LIMIT:'60',LLM_LEDGER_PATH:path.join(data,'llm-budget.json'),LLM_EXTRACTION_CACHE_DIR:path.join(data,'extraction-cache')});
  // Nothing found above leaves the Mac until this reader has confirmed it against its source.
  await upkeep('checkDetails','checkDetailsAt',HOUR,'Kontroluji nalezené údaje',['scripts/check-details.ts','--max=40','--seconds=420',`--gate=${path.join(data,'details-gate.json')}`],480,{LOCAL_ALLOW_AI:'1',LLM_LEDGER_PATH:path.join(data,'llm-budget.json')});
  await upkeep('websiteSearch','websiteSearchAt',WEBSITE_SEARCH_EVERY_MS,'Hledám weby závodů, které žádný nemají',['scripts/find-websites.ts','--apply','--max=40','--prefer=CZ,SK',`--countries=${COUNTRIES}`,`--from=${season}-01-01`],480,{BRAVE_SEARCH_LIMIT:'40',SEARCH_LEDGER_PATH:path.join(data,'search-budget.json')});
  // The agent: looks for regulations and judges possible duplicates the readers could not settle.
  // Its answers stay in the data folder; nothing of them is sent. One run a day, kept by the step itself.
  // Every six hours: prepare cases for the desk and check answers that arrived through it. The agent itself (Codex) works in its own session.
  await upkeep('agent','agentAt',6*HOUR,'Připravuji případy pro agenta a ověřuji jeho odpovědi',['scripts/agent-daily.cjs','--max=20'],2700,{AGENT_CASE_SECONDS:'120'});
  // What the agent found and the code verified goes to the gate as proposals; nothing else of the agent reaches the server.
  const agentAnswers=path.join(data,'agent','answers'),verifiedFile=path.join(agentAnswers,'verified.json');
  const verifiedAt=()=>{try{return fs.statSync(verifiedFile).mtimeMs;}catch{return 0;}};
  if(verifiedAt()>(state.agentAppliedMs??0)){
   stage('Předávám ověřené nálezy agenta bráně');
   try{
    const seen=verifiedAt();const handed=await node(tsx,['scripts/agent-apply.ts',`--answers=${agentAnswers}`,'--apply'],{timeout:10*60_000});
    const line=handed.output.split('\n').find(text=>text.startsWith('agent_apply '));report.agentApplied=line?JSON.parse(line.slice(12)):null;
    state.agentAppliedMs=seen;saveState();
   }catch(e){if(interrupted)throw e;(report.steps??={}).agentApply={outcome:'failed',reason:'crashed'};(report.failedUpkeep??=[]).push('agentApply');console.warn(`Předání nálezů agenta se nepovedlo: ${e.message}`);}
  }
  // Regulations links the readers here put into the copy go to the server as proposals, not with the fills.
  await upkeep('localRegulations','localRegulationsAt',HOUR,'Předávám nalezené odkazy na propozice bráně',['scripts/pipeline2-local-regulations.ts','--apply','--max=60'],600,{},true);
  // Links the gate accepted on the server are filled into the copy here, so the regulations reader finds them.
  try{report.pulledRegulations=pullAccepted(state);saveState();}catch(e){console.warn(`Přijaté odkazy se nepodařilo převzít: ${String(e.message).split('\n')[0].slice(0,160)}`);}
  await upkeep('geocode','geocodedAt',GEOCODE_EVERY_MS,'Doplňuji místa na mapě',['scripts/geocode-pending.ts','120'],300);
  await upkeep('sourceHealth','sourceHealthAt',SOURCE_HEALTH_EVERY_MS,'Kontroluji zdroje, které zmlkly',['scripts/local-source-health.ts',`--out=${path.join(data,'source-health-latest.json')}`],480);
  save();

  // Part 4: the target copy, only when sending could act on it.
  const eventsNow=sql('letsrace',`select (select count(*)||':'||coalesce(max(created_at)::text,'') from public.events)||'|'||(select count(*) from public.event_facts)||'|'||(select count(*) from public.event_categories)||'|'||(select count(*) from public.locations where lat is not null)`).trim();
  if(targetNeeded(state,eventsNow)){
   try{
    stage('Načítám aktuální katalog ze serveru');report.targetRead=true;
    await run(process.execPath,['scripts/local-pull.cjs','--target-only'],{timeout:120000});
    remote=`letsrace_auto_${process.pid}_${Date.now()}`;
    sql('postgres',`create database ${remote} template letsrace_baseline`);
    // This disposable target is the only database cleared here. The working
    // catalogue, baseline and previous pass snapshots are never deleted.
    sql(remote,`truncate ${COPY.map(t=>`public.${t}`).join(',')} restart identity cascade`);
    await run(`${BIN}/pg_restore`,['-h','127.0.0.1','-p','54329','-U','postgres','-d',remote,'--data-only','--disable-triggers','--no-owner',path.join(data,'local-copy/target.dump')],{timeout:120000});
    applyPauses(JSON.parse(sql(remote,"select coalesce(json_agg(id),'[]') from public.watched_urls where status<>'active'")));
    state.pausesSyncedAt=new Date().toISOString();
    stage('Kontroluji nové závody proti aktuálnímu katalogu');
    const planDir=path.join(directory,'plan');plan(planDir,'letsrace',remote,{onlyFactsOfNewRaces:true});
    await node('./node_modules/tsx/dist/cli.mjs',['scripts/local-review-new.ts',`--plan=${planDir}`,`--catalogue=${remote}`,'--only-new-races',`--max-new=${NEW_RACES_PER_SEND}`,`--separate=${path.join(data,'agent','separate.json')}`,`--races=${path.join(data,'agent','races.json')}`],{timeout:12*60_000});
    const reviewed=json(path.join(planDir,'plan.json'));
    report.heldRaces=reviewed.newRaces.held.length;report.deferredNewRaces=reviewed.newRaces.deferredByBatchLimit;
    // A rehearsal stops here, with the plan on disk and nothing sent.
    if(process.argv.includes('--no-send')){report.rehearsal=true;save();}
    else if(reviewed.rows){
     const file=path.join(planDir,'changes.ndjson'),sha=assertReviewed(file);
     stage('Zkouším bezpečné uložení výsledků');
     const dry=await run(process.execPath,['scripts/local-sync.cjs','send',`--changes=${file}`,`--confirm=${sha}`,'--dry-run']);
     const predicted=JSON.parse(dry.output);atomic(path.join(directory,'dry-run.json'),predicted);
     if(predicted.totals.failed||predicted.totals.conflict||predicted.totals.pending||predicted.totals.group_held)throw Error('Odeslání narazilo na konflikt; původní údaje zůstávají beze změny');
     stage('Odesílám zkontrolované nové závody');
     const sent=await run(process.execPath,['scripts/local-sync.cjs','send',`--changes=${file}`,`--confirm=${sha}`]);
     const result=JSON.parse(sent.output);atomic(path.join(directory,'sent.json'),result);
     report.publishedNewRaces=result.byTable['public.events']?.applied||0;save();
     if(result.totals.failed||result.totals.conflict||result.totals.pending||result.totals.group_held)throw Error('Část odeslání čeká na nové posouzení; potvrzení je v databázi');
     stage('Kontroluji potvrzení veřejných stránek');
     const rows=fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(r=>r.tab==='public.events');
     // The existing publication worker checks content, revisions and all locales
     // under the shared 60/day budget. Do not add an unmetered parallel checker.
     if(rows.some(r=>!/^[-a-f0-9]{36}$/.test(r.pk.id)))throw Error('Neplatný identifikátor závodu');
     // The races are saved by now; not knowing whether their pages are checked yet is no failure.
     let statuses=[];
     try{statuses=JSON.parse(cp.execFileSync(`${BIN}/psql`,['-qAt','-v','ON_ERROR_STOP=1','-c',`select coalesce(json_agg(json_build_object('id',entity_id,'verified',status='done' and result ? 'verifiedAt')),'[]') from public.pipeline_tasks where kind='public_refresh' and entity_id in (${rows.map(r=>`'${r.pk.id}'`).join(',')})`],{encoding:'utf8',timeout:30_000,env:{...serverEnvironment(),NODE_OPTIONS:''}}));}
     catch(e){report.publicCheckError=String(e.message).split('\n').at(-2)?.slice(0,200)??'neznámá chyba';console.warn(`Stav veřejných stránek nezjištěn: ${report.publicCheckError}`);}
     for(const row of rows)report.publicChecks.push({id:row.pk.id,slug:row.after.slug,verified:statuses.find(s=>s.id===row.pk.id)?.verified===true});
     save();
    }
    // Details for races already on the server. A conflict here only means someone got there
    // first, so it is noted and never stops anything; the field just stays as it is.
    const today=new Date().toISOString().slice(0,10);if(state.fillDay?.date!==today)state.fillDay={date:today,races:0};
    const allowance=Math.min(FILLED_RACES_PER_CYCLE,FILLED_RACES_PER_DAY-state.fillDay.races);
    const fills=fillPlan(path.join(directory,'fills'),{target:remote,maxRaces:Math.max(0,allowance),gate:json(path.join(data,'details-gate.json'),{})});
    report.fills={races:fills.races,places:fills.places,waiting:fills.waiting};state.fillsWaiting=allowance>0?fills.waiting:0;
    // While this file exists, details found here wait for a quality check and nothing of them is sent.
    report.detailsHeld=fs.existsSync(path.join(data,'hold-details.json'));
    if(fills.rows&&!report.rehearsal&&!report.detailsHeld){
     stage('Odesílám doplněné údaje');
     const sentFills=await run(process.execPath,['scripts/local-sync.cjs','send',`--changes=${fills.file}`,`--confirm=${fills.sha256}`,`--problems=${path.join(directory,'fills','problems.json')}`]);
     const result=JSON.parse(sentFills.output);atomic(path.join(directory,'fills','sent.json'),result);
     report.updatedRaces=result.byTable['public.events']?.applied||0;report.filledPlaces=result.byTable['public.locations']?.applied||0;report.fills.conflicts=result.totals.conflict+result.totals.failed;
     state.fillDay.races+=report.updatedRaces;save();
    }
    if(!report.rehearsal){state.targetCheckedAt=new Date().toISOString();state.eventsAtLastPlan=eventsNow;state.deferredNewRaces=report.deferredNewRaces;state.sendFailed=false;saveState();}
   }catch(e){if(interrupted)throw e;state.sendFailed=true;saveState();note(e);}
  }else report.heldRaces=state.heldRaces??0;
  if(report.targetRead&&!failed){state.heldRaces=report.heldRaces;saveState();}

  // What the runner needs to decide when to come back.
  const dueAfter=Number(sql('letsrace',dueNow).trim());report.dueSourcesAfter=dueAfter;
  // A race refused again is not progress: organiser.attempted counts those too.
  report.progressed=report.readAttempts>0||organiser.read>0||organiser.published>0||report.publishedNewRaces>0||report.updatedRaces>0;
  report.moreWork=moreWorkLeft({readAttempts:report.readAttempts,dueAfter,organiserRead:organiser.read,organiserPublished:organiser.published,organiserUnread:organiser.unread,organiserDeferred:organiser.deferred});
  const nextPoll=sql('letsrace',"select coalesce(min(next_poll_at),now()+interval '6 hours') from public.watched_urls where status='active' and next_poll_at>now()").trim();
  const moments=[Date.parse(nextPoll.replace(' ','T').replace(/([+-]\d\d)$/,'$1:00'))];
  if(organiser.nextDueAt)moments.push(Math.max(Date.parse(organiser.nextDueAt),state.organiserPassAt?Date.parse(state.organiserPassAt)+ORGANISER_GAP_MS:0));
  if(state.targetCheckedAt)moments.push(Date.parse(state.targetCheckedAt)+(targetWanted(state,eventsNow,Date.parse(state.targetCheckedAt))?TARGET_MIN_GAP_MS:TARGET_MAX_AGE_MS));
  if(state.siteDetailsAt)moments.push(Date.parse(state.siteDetailsAt)+SITE_DETAILS_EVERY_MS);
  if(aiWaiting){report.aiWaitingUntil=new Date(nextPragueDay()).toISOString();moments.push(nextPragueDay());}
  else if(state.regulationsAt)moments.push(Date.parse(state.regulationsAt)+REGULATIONS_EVERY_MS);
  report.nextWorkAt=new Date(Math.min(...moments.filter(Number.isFinite),Date.now()+6*HOUR)).toISOString();
  if(failed)throw Error(failed);
  // The raw report stays available; a checked public race is distinct from an extracted row.
  // Pages are checked by a server queue that takes days, and nothing ever returned to this report,
  // so every cycle that delivered a race used to end "unfinished" for good. The count stays on record.
  report.pagesAwaitingCheck=report.publicChecks.filter(c=>!c.verified).length;
  // The summary the panel and the desktop window read, made from what the cycles saved.
  try{await node(tsx,['scripts/pipeline-status.ts','--summary'],{timeout:60_000});}catch(e){console.warn(`Souhrn se nepodařilo obnovit: ${e.message}`);}
  report.failedSteps=report.failedUpkeep?.length??0;
  report.state=report.unfinishedSources||report.failedSteps?'attention':'finished';report.stage=report.state==='finished'?'Hotovo':report.failedSteps?`Nedokončené kroky: ${report.failedUpkeep.join(', ')}`:'Část práce nemá dokončený výsledek';
  if(report.state==='attention')process.exitCode=1;
 }catch(e){report.state='attention';report.error=e.message;if(!failed)console.error(`!!! ${e.message}`);process.exitCode=1;}
 finally{
  report.finishedAt=new Date().toISOString();report.seconds=Math.round((Date.now()-started)/1000);save();
  if(remote)try{sql('postgres',`drop database ${remote}`);}catch{console.warn('Dočasný porovnávací katalog zůstal zachovaný.');}
  // A cycle that found nothing to do leaves its result in local-cycle-latest.json and no folder behind.
  if(report.state==='finished'&&!report.progressed&&!report.targetRead&&!report.upkeep)fs.rmSync(directory,{recursive:true,force:true});
  release();console.log('local_cycle_result '+JSON.stringify(report));
  console.log(`=== done ${report.finishedAt}\n=== failed steps: ${report.state==='attention'?1:0}\n=== deferred steps: 0`);
 }
}
module.exports={holdAfter,heldNow,sleptThrough,FAILURE_DELAYS_MS,stepOutcome,STEP_OUTCOMES,acquireLock,run,organiserDue,targetNeeded,targetWanted,editionSeason,coverageFrom,aiAllowanceLeft,nextPragueDay};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
