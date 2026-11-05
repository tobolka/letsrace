/** One managed cycle: durable local work, fresh target catalogue, reviewed new races.
 * No collector receives production credentials. Existing-event edits stay in review.
 * The working copy is never reset by this command; source hashes and pending work survive.
 */
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const cp=require('node:child_process');
const {plan,assertReviewed}=require('./local-sync.cjs');
const {COPY,serverEnvironment}=require('./local-pull.cjs');
const BIN=process.env.LOCAL_PG_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const data=process.env.LETSRACE_DATA_DIR||path.join(os.homedir(),'Library/Application Support/LetsRace/data');
const root=path.resolve(__dirname,'..');const env={...process.env,LC_ALL:'en_US.UTF-8',PGTZ:'UTC'};
const json=(file,fallback=null)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const atomic=(file,value)=>{const p=`${file}.${process.pid}.tmp`;fs.writeFileSync(p,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(p,file);};
const sql=(db,query)=>cp.execFileSync(`${BIN}/psql`,['-h','127.0.0.1','-p','54329','-U','postgres','-d',db,'-qAt','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',maxBuffer:2**29,env:{...env,NODE_OPTIONS:''}});
let interrupted=false;
function acquireLock(file){
 try{fs.writeFileSync(file,JSON.stringify({pid:process.pid,at:new Date().toISOString()}),{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw e;const old=json(file);if(!old?.pid)throw Error('Nečitelný zámek místního běhu');let alive=true;try{process.kill(old.pid,0);}catch(x){if(x.code==='ESRCH')alive=false;else throw x;}if(alive)throw Error('Místní průchod už běží');fs.unlinkSync(file);return acquireLock(file);}
 return ()=>{if(json(file)?.pid===process.pid)fs.unlinkSync(file);};
}
function run(command,args,{allowSourceFailures=false,timeout=120000}={}){
 return new Promise((resolve,reject)=>{
  if(interrupted)return reject(Error('Běh byl zastaven; uložená práce zůstává na příště'));
  const child=cp.spawn(command,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='';let timedOut=false;
  let killTimer;const stop=()=>{child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),15000);killTimer.unref();};
  const timer=setTimeout(()=>{timedOut=true;stop();},timeout);const abort=()=>{interrupted=true;stop();};process.once('SIGTERM',abort);process.once('SIGINT',abort);
  child.stdout.on('data',b=>{process.stdout.write(b);output=(output+b).slice(-(2**22));});child.stderr.on('data',b=>process.stderr.write(b));
  child.once('error',reject);child.once('close',(code,signal)=>{clearTimeout(timer);clearTimeout(killTimer);process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);if(!interrupted&&!timedOut&&!signal&&(code===0||allowSourceFailures&&[1,2].includes(code)))resolve({code,output});else reject(Error(`${path.basename(args[0]||command)}: ${interrupted?'běh zastaven':timedOut?'časový limit':signal||code}`));});
 });
}
async function main(){
 fs.mkdirSync(data,{recursive:true,mode:0o700});const release=acquireLock(path.join(data,'local-cycle.lock'));
 const started=Date.now(),runId=new Date().toISOString().replace(/[:.]/g,'-'),directory=path.join(data,'local-cycles',runId);fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const report={version:1,id:runId,startedAt:new Date().toISOString(),state:'running',stage:'Příprava',publishedNewRaces:0,updatedRaces:0,heldRaces:0,readSources:0,publicChecks:[],sourceFailures:0,aiCostUsd:0};
 const save=()=>{atomic(path.join(directory,'result.json'),report);atomic(path.join(data,'local-cycle-latest.json'),report);};
 const stage=text=>{report.stage=text;save();console.log(`=== ${text} (${new Date().toISOString()})`);};
 const node=(file,args=[],options)=>run(process.execPath,['scripts/with-node.cjs',file,...args],options);
 let remote;
 try{
  stage('Načítám aktuální katalog ze serveru');
  await run(process.execPath,['scripts/local-pull.cjs'],{timeout:120000});
  await run('/bin/bash',['scripts/local-db.sh','start']);
  if(sql('postgres',"select count(*) from pg_database where datname in ('letsrace','letsrace_baseline')").trim()!=='2')throw Error('Chybí první připravená místní kopie katalogu');
  remote=`letsrace_auto_${process.pid}_${Date.now()}`;
  sql('postgres',`create database ${remote} template letsrace_baseline`);
  // This disposable target is the only database cleared here. The working
  // catalogue, baseline and previous pass snapshots are never deleted.
  sql(remote,`truncate ${COPY.map(t=>`public.${t}`).join(',')} restart identity cascade`);
  await run(`${BIN}/pg_restore`,['-h','127.0.0.1','-p','54329','-U','postgres','-d',remote,'--data-only','--disable-triggers','--no-owner',path.join(data,'local-copy/catalogue-baseline.dump')],{timeout:120000});
  // An operator's server-side source pause must also stop this local collector.
  const disabled=JSON.parse(sql(remote,"select coalesce(json_agg(id),'[]') from public.watched_urls where status<>'active'"));
  if(disabled.length)sql('letsrace',`update public.watched_urls set status='paused' where status='active' and id in (${disabled.map(id=>`'${id}'::uuid`).join(',')})`);
  stage('Čtu splatné zdroje na Macu');
  await run('/bin/bash',['scripts/local-run.sh',process.execPath,'scripts/local-parallel.cjs','--workers=4','--limit=24','--seconds=90','--max-minutes=15'],{allowSourceFailures:true,timeout:17*60_000});
  const sourceReport=path.join(directory,'sources.json');await node('./node_modules/tsx/dist/cli.mjs',['scripts/local-report.ts',`--out=${sourceReport}`,`--since=${report.startedAt}`]);
  report.sourceReport=sourceReport;
  const summary=json(sourceReport);report.readSources=summary.overall.sourcesRead;report.sourceFailures=summary.overall.failed;report.unreadableSources=summary.overall.unreadable;report.deferredSources=summary.overall.deferred;report.unfinishedSources=summary.overall.unfinished;report.problems=summary.problems;
  const attempts=JSON.parse(sql('letsrace', `select json_build_object('reads',count(*),'databaseRequests',coalesce(sum((metrics#>>'{database,attempts}')::int),0)) from public.ingest_runs where started_at >= '${report.startedAt}'`));
  report.readAttempts=attempts.reads;report.localDatabaseRequests=attempts.databaseRequests;
  stage('Kontroluji nové závody proti aktuálnímu katalogu');
  const planDir=path.join(directory,'plan');plan(planDir,'letsrace',remote);
  await node('./node_modules/tsx/dist/cli.mjs',['scripts/local-review-new.ts',`--plan=${planDir}`,`--catalogue=${remote}`,'--only-new-races','--max-new=20'],{timeout:12*60_000});
  const reviewed=json(path.join(planDir,'plan.json'));
  report.heldRaces=reviewed.newRaces.held.length;report.deferredNewRaces=reviewed.newRaces.deferredByBatchLimit;
  if(reviewed.rows){
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
   const statuses=JSON.parse(cp.execFileSync(`${BIN}/psql`,['-qAt','-v','ON_ERROR_STOP=1','-c',`select coalesce(json_agg(json_build_object('id',event_id,'verified',status='done' and result ? 'verifiedAt')),'[]') from public.pipeline_tasks where kind='public_refresh' and event_id in (${rows.map(r=>`'${r.pk.id}'::uuid`).join(',')})`],{encoding:'utf8',env:{...serverEnvironment(),NODE_OPTIONS:''}}));
   for(const row of rows)report.publicChecks.push({id:row.pk.id,slug:row.after.slug,verified:statuses.find(s=>s.id===row.pk.id)?.verified===true});
   save();
  }
  // The raw report stays available; a checked public race is distinct from an extracted row.
  report.state=report.publicChecks.some(c=>!c.verified)?'publication_pending':report.unfinishedSources?'attention':'finished';report.stage=report.state==='finished'?'Hotovo':report.state==='attention'?'Část práce nemá dokončený výsledek':'Čekám na zobrazení na webu';
  if(report.state==='attention')process.exitCode=1;
 }catch(e){report.state='attention';report.error=e.message;console.error(`!!! ${e.message}`);process.exitCode=1;}
 finally{
  report.finishedAt=new Date().toISOString();report.seconds=Math.round((Date.now()-started)/1000);save();
  if(remote)try{sql('postgres',`drop database ${remote}`);}catch{console.warn('Dočasný porovnávací katalog zůstal zachovaný.');}
  release();console.log('local_cycle_result '+JSON.stringify(report));
  console.log(`=== done ${report.finishedAt}\n=== failed steps: ${report.state==='attention'?1:0}\n=== deferred steps: ${report.state==='publication_pending'?1:0}`);
  if(report.state==='publication_pending')process.exitCode=2;
 }
}
module.exports={acquireLock,run};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
