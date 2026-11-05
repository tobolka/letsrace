/** Managed macOS runner: one scheduled child, durable controls and a truthful heartbeat. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');

function atomic(file, value) { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }
function json(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function alive(pid) { if (!Number.isInteger(pid) || pid <= 1) return false; try { process.kill(pid, 0); return true; } catch { return false; } }
function isDeferredExit(code, tail) {
 return code === 2 && /(?:^|\n)=== done [^\n]+\n=== failed steps: 0\n=== deferred steps: [1-9]\d*$/.test(String(tail||'').trimEnd());
}
function health({ active, paused, lastOutputAt, now, lastExitCode, deferredOnly=false }) {
 if (active) return now - lastOutputAt > 20 * 60_000 ? 'quiet' : 'running';
 if (paused) return 'paused';
 // refresh-data.sh reserves 2 for deferred work, with zero failed steps.
 // It resumes automatically; this is not an owner decision or a broken run.
 return lastExitCode != null && lastExitCode !== 0 && !(lastExitCode === 2 && deferredOnly) ? 'attention' : 'waiting';
}
function rememberResult(state, result) {
 state.history=[...(state.history||[]),result].filter(r=>r.at>Date.now()-24*60*60_000).slice(-100);
 if(result.reads||result.created||result.updated||result.queued||result.failed||result.deferred)state.lastActivityResult=result;
 state.lastResult=result;
}
// Older snapshots counted every unsupported read as a failure. Reclassify
// only recorded exact reasons; missing/truncated diagnostics remain failures.
function normalizeResult(result) {
 if (!result || result.unreadable != null) return result;
 const unreadable=(result.problems||[]).filter(p=>['unsupported_or_empty_source','low confidence or empty extract','dynamic_render_unavailable'].includes(p.error)).length;
 const count=Math.min(Number(result.failed||0),unreadable);
 return {...result,failed:Number(result.failed||0)-count,unreadable:count};
}
function recentResults(history, now=Date.now()) {
 const rows=(history||[]).filter(r=>r.at>now-24*60*60_000).map(normalizeResult);
 const totals={runs:rows.length,reads:0,created:0,updated:0,failed:0,deferred:0,unreadable:0};
 for(const row of rows)for(const key of ['reads','created','updated','failed','deferred','unreadable'])totals[key]+=Number(row[key]||0);
 return {...totals,problems:rows.flatMap(r=>r.problems||[]).slice(-30)};
}
function systemSample() {
 const out = { cpuPercent: null, memoryFreePercent: null, processes: [] };
 try {
  const top = execFileSync('/usr/bin/top', ['-l','1','-n','0'], { encoding:'utf8',timeout:3000,maxBuffer:300000 });
  const idle = top.match(/CPU usage:.*?([\d.]+)% idle/); if (idle) out.cpuPercent = Math.round(100-Number(idle[1]));
 } catch { /* unavailable is distinct from zero */ }
 try {
  const memory = execFileSync('/usr/bin/memory_pressure',['-Q'],{encoding:'utf8',timeout:3000});
  const free = memory.match(/free percentage:\s*(\d+)%/i); if(free)out.memoryFreePercent=Number(free[1]);
 } catch { /* optional */ }
 try {
  out.processes = execFileSync('/bin/ps',['-axo','pid=,%cpu=,comm='],{encoding:'utf8',timeout:3000,maxBuffer:600000}).split('\n').flatMap(line=>{
   const m=line.trim().match(/^(\d+)\s+([\d.]+)\s+(.+)$/);return m?[{pid:Number(m[1]),cpu:Number(m[2]),name:path.basename(m[3])}]:[];
  }).sort((a,b)=>b.cpu-a.cpu).slice(0,5);
 }catch{ /* optional */ }
 return out;
}
function managedCommand(root, override) { return override || path.join(root,'scripts/local-cycle.sh'); }
function main() {
 const root = path.resolve(__dirname, '..');
 const data = process.env.LETSRACE_DATA_DIR || path.join(os.homedir(),'Library/Application Support/LetsRace/data');
 fs.mkdirSync(data,{recursive:true,mode:0o700});
 const pidFile=path.join(data,'runner.pid');
 const previousPid=Number(fs.existsSync(pidFile)?fs.readFileSync(pidFile,'utf8'):0);
 if(alive(previousPid)) { console.error('Another managed runner is already alive');process.exit(1); }
 fs.writeFileSync(pidFile,String(process.pid),{mode:0o600});
 const stateFile=path.join(data,'runner-state.json'), controlFile=path.join(data,'control.json');
 const previous=json(stateFile);
 if(previous.lastExitCode===2 && previous.deferredOnly==null && previous.logPath && path.dirname(previous.logPath)===data){
  let fd;try{fd=fs.openSync(previous.logPath,'r');const size=fs.fstatSync(fd).size,b=Buffer.alloc(Math.min(size,4096));fs.readSync(fd,b,0,b.length,size-b.length);previous.deferredOnly=isDeferredExit(2,b.toString());}catch{}finally{if(fd!=null)fs.closeSync(fd);}
 }
 // Recover completed run history once when upgrading an installed collector.
 if(!previous.history){
  previous.history=[];
  for(const name of fs.readdirSync(data).filter(n=>/^refresh-.*\.log$/.test(n)).sort().slice(-50)){
   const file=path.join(data,name),at=fs.statSync(file).mtimeMs;
   if(at<Date.now()-24*60*60_000)continue;
   const log=fs.readFileSync(file,'utf8');if(!/^=== done /m.test(log))continue;
   const result={at,reads:0,created:0,updated:0,failed:0,deferred:0,unreadable:0,problems:[],logPath:file};
   for(const line of log.split('\n'))if(line.startsWith('pipeline_batch ')){try{const batch=JSON.parse(line.slice(15));for(const key of ['reads','created','updated','failed','deferred','unreadable'])result[key]+=Number(batch[key]||0);result.problems.push(...(batch.problems||[]));}catch{}}
   rememberResult(previous,result);
  }
 }
 const priorReport=json(path.join(data,'last-problems.json'),null);
 if(!previous.lastResult && priorReport)previous.lastResult={...priorReport,at:Date.parse(priorReport.at)};
 // Old runs counted local writes as changes. Keep their evidence, but never
 // mix those counts into the new mode's actually uploaded catalogue results.
 if(!process.env.LETSRACE_RUN_COMMAND && previous.resultMode!=='local-new-races'){
  const archive=path.join(data,'legacy-run-results-before-local-cycles.json');
  if(!fs.existsSync(archive))atomic(archive,{history:previous.history||[],lastResult:previous.lastResult||null});
  const cycle=previous.cycleResult;
  previous.history=[];previous.lastActivityResult=null;previous.lastResult=null;
  if(cycle?.finishedAt){const result={at:Date.parse(cycle.finishedAt),created:Number(cycle.publishedNewRaces||0),updated:Number(cycle.updatedRaces||0),reads:Number(cycle.readSources||0),failed:Number(cycle.sourceFailures||0),unreadable:Number(cycle.unreadableSources||0),deferred:Number(cycle.deferredSources||0),queued:Number(cycle.heldRaces||0),problems:cycle.problems||[]};rememberResult(previous,result);}
  previous.resultMode='local-new-races';
 }
 const lastBrowser=json(path.join(data,'pipeline-browser-status.json'),null);
 if(!previous.durations?.federation && lastBrowser?.log===previous.logPath && previous.lastFinishedAt>previous.startedAt)previous.durations={...previous.durations,federation:[previous.lastFinishedAt-previous.startedAt]};
 // A hard crash can leave the child alive. Retire only our recorded process
 // group after verifying its command, before starting another copy.
 if(previous.childPid && alive(previous.childPid)){
  let command='';try{command=execFileSync('/bin/ps',['-p',String(previous.childPid),'-o','command='],{encoding:'utf8'}).trim();}catch{}
  if(command.startsWith('/usr/bin/caffeinate -i /bin/bash ') && command.includes(root+'/scripts/')){
   try{process.kill(-previous.childPid,'SIGTERM');}catch{}
  }
 }
 if(previous.childPid && previous.activeTask==='federation')previous.pendingTasks=[...new Set([...(previous.pendingTasks||[]),'federation'])];
 let state={...previous,childPid:null,stage:null,serverRequestRunning:false,interrupted:previous.childPid!=null};
 let child=null, logStream=null, buffer='', stopping=false, system=systemSample(), lastSystem=Date.now(), server=json(path.join(data,'server-status.json'),null), serverChecking=false, serverChecked=0;
 let reportedPause;
 const interval=Number(process.env.LETSRACE_INTERVAL_MS || 12*60*60_000);
 state.nextRunAt=state.interrupted?Date.now()+15000:Number(state.nextRunAt||Date.now());
 const save=()=>atomic(stateFile,state);
 async function runServer() {
  state.serverRequestRunning=false;
  state.serverRequestError='Sběr teď probíhá na Macu; staré serverové spouštění je vypnuté.';
  save();snapshot();
 }
 async function checkServer() {
  if(process.env.LETSRACE_NO_SERVER_CHECK === "1" || serverChecking)return;
  const paused=json(controlFile).paused===true, now=Date.now();
  // Keep the paused heartbeat within the panel's 15-minute freshness window.
  if(paused===reportedPause && now-serverChecked<(paused?10:5)*60_000)return;
  serverChecking=true;serverChecked=now;reportedPause=paused;
  try {
    const {parse}=require('dotenv');
    const env=parse(fs.readFileSync(path.join(root,'.env.local')));
    if(!env.CRON_SECRET)throw Error('Chybí přístup ke stavu serveru');
    const last=normalizeResult(state.lastResult);
    const lastResult=last?Object.fromEntries(['at','reads','created','updated','failed','deferred','unreadable'].filter(key=>typeof last[key]==='number').map(key=>[key,last[key]])):null;
    const response=await fetch('https://letsrace.cz/api/ops/pipeline-status',{method:'POST',headers:{Authorization:`Bearer ${env.CRON_SECRET}`,'Content-Type':'application/json'},
     body:JSON.stringify({status:health({active:!!child,paused,lastOutputAt:state.lastOutputAt||now,now,lastExitCode:state.lastExitCode,deferredOnly:state.deferredOnly}),paused,nextRunAt:state.nextRunAt||null,lastResult}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Stav serveru není dostupný (HTTP ${response.status})`);
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Přehled serveru zatím není dostupný');
    server={...(await response.json()),checkedAt:new Date().toISOString(),error:null};
    atomic(path.join(data,'server-status.json'),server);
  }catch(e){server={...server,error:e.message,attemptedAt:new Date().toISOString()};}
  finally{serverChecking=false;snapshot();}
 }
 function snapshot() {
  const control=json(controlFile), now=Date.now();
  if(now-lastSystem>30000){system=systemSample();lastSystem=Date.now();}
  const ledger=json(process.env.LLM_LEDGER_PATH||path.join(data,'llm-budget.json'));
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');
  const browser=json(path.join(data,'pipeline-browser-status.json'),null);
  const overview=json(path.join(data,'catalogue-overview-latest.json'),null);
  const totals=overview?.summary?.filter(r=>r.key?.endsWith(':ALL')).map(r=>({season:r.key.split(':')[0],total:r.total,essentials:r.populatedEssentials}))||[];
  atomic(path.join(data,'monitor.json'),{version:1,at:new Date().toISOString(),pid:process.pid,root,data,
   status:health({active:!!child,paused:control.paused===true,lastOutputAt:state.lastOutputAt||now,now,lastExitCode:state.lastExitCode,deferredOnly:state.deferredOnly}),
   activeTask:state.activeTask||null,pendingTasks:state.pendingTasks||[],paused:control.paused===true,childPid:child?.pid||null,stage:state.stage,startedAt:state.startedAt||null,lastOutputAt:state.lastOutputAt||null,
   lastFinishedAt:state.lastFinishedAt||null,lastExitCode:state.lastExitCode??null,nextRunAt:state.nextRunAt,
   pipelineMode:"local-new-races",cycleResult:state.cycleResult||null,server,serverRequestRunning:state.serverRequestRunning===true,serverRequestError:state.serverRequestError||null,estimates:state.durations||{},catalogueAt:overview?.at||null,lastResult:normalizeResult(state.lastResult)||null,lastActivityResult:normalizeResult(state.lastActivityResult)||null,recent:recentResults(state.history),logPath:state.logPath||null,lastError:state.lastError||null,counters:state.counters||{},browser,totals,
   ai:{lastRunAt:state.lastAiFinishedAt||null,month,spentUsd:ledger.months?.[month]??0,monthCapUsd:5,dayCapUsd:0.5,schedule:'Mac · úterý a pátek'},
   system,countries:['CZ','SK','DE','AT','CH','IT','PL'],interrupted:state.interrupted===true});
 }
 function start(task="refresh") {
  if(child||stopping)return;
  // Every native-panel action uses the same isolated local cycle. There is
  // no legacy federation or paid task that can accidentally write to production.
  if(!process.env.LETSRACE_RUN_COMMAND){task='refresh';state.pendingTasks=[];}
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  state={...state,activeTask:task,aiDetected:task==='ai',problems:[],stage:task==='federation'?'Sken federace ČSC přes Chrome':'Příprava sběru',startedAt:Date.now(),lastOutputAt:Date.now(),lastError:null,interrupted:false,deferredOnly:false,runTail:'',counters:{reads:0,created:0,updated:0,failed:0,deferred:0,unreadable:0,unchanged:0,leads:0,queued:0},logPath:path.join(data,`refresh-${stamp}.log`)};
  logStream=fs.createWriteStream(state.logPath,{flags:'a',mode:0o600});buffer='';
  const command=managedCommand(root,process.env.LETSRACE_RUN_COMMAND);
  child=spawn('/usr/bin/caffeinate',['-i','/bin/bash',command],{cwd:root,env:{...process.env,LETSRACE_MANAGED:"1",...(task==='ai'?{PIPELINE_AI_MODE:'ai'}:task==='federation'?{PIPELINE_AI_MODE:'free'}:{}),LLM_LEDGER_PATH:path.join(data,'llm-budget.json')},detached:true,stdio:['ignore','pipe','pipe']});
  state.childPid=child.pid;save();snapshot();
  const record=chunk=>{
   state.lastOutputAt=Date.now();logStream?.write(chunk);buffer+=chunk.toString();state.runTail=(state.runTail+chunk.toString()).slice(-4096);
   const lines=buffer.split('\n');buffer=lines.pop().slice(-20000);
   for(const line of lines){
    if(line.startsWith('Pipeline mode: ai;'))state.aiDetected=true;
    const stage=line.match(/^=== (.+?)\s+\(\d/);if(stage)state.stage=stage[1];
    if(line.startsWith('pipeline_batch ')){try{const m=JSON.parse(line.slice(15));for(const k of ['reads','created','updated','failed','deferred','unreadable','unchanged'])state.counters[k]+=Number(m[k]||0);state.problems.push(...(m.problems||[]));}catch{}}
    if(line.startsWith('local_cycle_result ')){try{const m=JSON.parse(line.slice(19));state.counters.created=Number(m.publishedNewRaces||0);state.counters.updated=Number(m.updatedRaces||0);state.counters.reads=Number(m.readSources||0);state.counters.failed=Number(m.sourceFailures||0)+(m.state==='attention'?1:0);state.counters.unreadable=Number(m.unreadableSources||0);state.counters.deferred=Number(m.deferredSources||0);state.counters.queued=Number(m.heldRaces||0);state.problems=m.problems||[];state.cycleResult=m;}catch{}}
    if(line.startsWith('pipeline_discovery ')){try{state.counters.leads+=Number(JSON.parse(line.slice(19)).leads||0);}catch{}}
    if(line.startsWith('pipeline_federation ')){try{const m=JSON.parse(line.slice(20)),old=json(path.join(data,'pipeline-browser-status.json'));atomic(path.join(data,'pipeline-browser-status.json'),{...m,at:new Date().toISOString(),log:state.logPath,lastReadAt:m.read>0?new Date().toISOString():old.lastReadAt,lastReadCount:m.read>0?m.read:old.lastReadCount});if(task==='federation'){state.counters.reads++;state.counters.created+=Number(m.created||0);state.counters.updated+=Number(m.updated||0);}}catch{}}
    if(line.startsWith('pipeline_candidates ')){try{state.counters.queued+=Number(JSON.parse(line.slice(20)).queued||0);}catch{}}
    if(/^!!! |^Error:|^error:/i.test(line))state.lastError=line.slice(0,500);
   }
  };
  child.stdout.on('data',record);child.stderr.on('data',record);
  child.on('error',e=>{state.lastError=e.message;});
  child.on('close',(code,signal)=>{
   state.deferredOnly=isDeferredExit(code,state.runTail);
   child=null;state.childPid=null;state.durations={...state.durations,[task]:[...(state.durations?.[task]||[]),Date.now()-state.startedAt].slice(-5)};state.lastExitCode=code??1;state.lastFinishedAt=Date.now();if(state.aiDetected)state.lastAiFinishedAt=state.lastFinishedAt;if(task!=='federation')state.nextRunAt=Date.now()+interval;
   if(signal)state.lastError=`Běh ukončen (${signal}); další pokus naváže na uložená data.`;
   if(task!=='federation')rememberResult(state,{...state.counters,problems:state.problems||[],at:state.lastFinishedAt,exitCode:state.lastExitCode,logPath:state.logPath});state.activeTask=null;state.stage=null;logStream?.end();logStream=null;save();snapshot();if(stopping)finish();
  });
 }
 function tick(){
  if(stopping)return;
  const control=json(controlFile);
  if(control.serverRunNowAt&&control.serverRunNowAt!==state.handledServer){state.handledServer=control.serverRunNowAt;save();void runServer();}
  if(control.serverRefreshAt&&control.serverRefreshAt!==state.handledServerRefresh){state.handledServerRefresh=control.serverRefreshAt;serverChecked=0;save();}
  if(control.runNowAt&&control.runNowAt!==state.handledRunNow){state.handledRunNow=control.runNowAt;if(!child)state.nextRunAt=Date.now();save();}
  if(control.stopRunAt&&control.stopRunAt!==state.handledStop){state.handledStop=control.stopRunAt;save();if(child){try{process.kill(-child.pid,'SIGTERM');}catch{}}}
  for(const [key,task] of [['scanNowAt','federation'],['aiNowAt','ai'],['refreshNowAt','refresh']]) {
   if(control[key]&&control[key]!==state[key]){state[key]=control[key];state.pendingTasks=[...new Set([...(state.pendingTasks||[]),task])];save();}
  }
  if(!child&&control.paused!==true){
   if(state.pendingTasks?.length){const task=state.pendingTasks.shift();save();start(task);}
   else if(Date.now()>=state.nextRunAt)start();
  }
  snapshot();void checkServer();
 }
 function finish(){try{if(Number(fs.readFileSync(pidFile,'utf8'))===process.pid)fs.unlinkSync(pidFile);}catch{}process.exit(0);}
 function shutdown(){stopping=true;if(child){try{process.kill(-child.pid,'SIGTERM');}catch{}setTimeout(finish,8000).unref();}else finish();}
 process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
 save();tick();setInterval(tick,10000);
}
module.exports={managedCommand,health,isDeferredExit,alive,json,atomic,rememberResult,recentResults,normalizeResult};
if(require.main===module)main();
