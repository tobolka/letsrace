/** Read-only status from the one installed collector; no second/manual loop. */
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {summarise,type CycleResult} from '../src/lib/pipeline2/status';
import {dayRow,historyTable,withDay,type AgentCounts,type DayRow,type GateCounts} from '../src/lib/pipeline2/history';
import {checkSearxngHealth} from '../src/lib/catalog/searxng';
const read=async(p:string)=>{try{return JSON.parse(await readFile(p,'utf8'));}catch{return null;}};
async function main(){
 const base=join(homedir(),'Library/Application Support/LetsRace');
 const installation=await read(join(base,'installation.json'));
 const data=installation?.data??join(base,'data');
 const monitor=await read(join(data,'monitor.json'));
 const live=(label:string)=>{try{return /state = running/.test(execFileSync('launchctl',['print',`gui/${process.getuid!()}/${label}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch{return false;}};
 const status={at:new Date().toISOString(),installation,runner:live('cz.letsrace.runner'),panel:live('cz.letsrace.monitor'),legacyAgent:live('cz.letsrace.ingest-csc'),heartbeatAgeSeconds:monitor?.at?Math.round((Date.now()-Date.parse(monitor.at))/1000):null,monitor};
 // Let a held or stopped step try again at the next cycle: --retry=<step or website>.
 const retry=process.argv.find(a=>a.startsWith('--retry='))?.slice(8);
 if(retry){
  const {existsSync}=await import('node:fs');
  if(existsSync(join(data,'local-cycle.lock'))){console.error('Průchod právě běží a přepsal by změnu; zkus to znovu, až doběhne.');process.exitCode=1;return;}
  const file=join(data,'local-cycle-state.json');const state=JSON.parse(readFileSync(file,'utf8'));
  const key=Object.keys(state.stepHolds??{}).find(k=>k===retry||state.stepHolds[k].steps?.includes(retry));
  if(!key){console.log(`Krok ${retry} na nic nečeká.`);return;}
  const {steps=[],reason,failures}=state.stepHolds[key];delete state.stepHolds[key];
  writeFileSync(`${file}.${process.pid}.tmp`,JSON.stringify(state,null,2),{mode:0o600});renameSync(`${file}.${process.pid}.tmp`,file);
  console.log(`Uvolněno: ${[key,...steps.filter((s:string)=>s!==key)].join(', ')} (${reason??'bez důvodu'}, ${failures??0} selhání). Zkusí se při příštím průchodu.`);return;
 }
 // The honest summary, from what the cycles themselves saved. Derived each time, written for the panel.
 const cycles:CycleResult[]=[];
 try{for(const name of readdirSync(join(data,'local-cycles')).sort().slice(-1500)){try{cycles.push(JSON.parse(readFileSync(join(data,'local-cycles',name,'result.json'),'utf8')));}catch{/* A cycle still running, or one that left no result. */}}}catch{/* No cycles yet. */}
 const now=new Date();
 const summary=summarise({cycles,now,macReportAt:monitor?.at??null,aiLedger:await read(join(data,'llm-budget.json')),aiDay:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)});
 if(!process.argv.includes('--no-write')){try{const file=join(data,'status.json');writeFileSync(`${file}.${process.pid}.tmp`,JSON.stringify(summary,null,2),{mode:0o600});renameSync(`${file}.${process.pid}.tmp`,file);}catch(e){console.warn(`Souhrn se nepodařilo uložit: ${(e as Error).message}`);}}
 // One row a day of the numbers version 2 is judged by.
 const historyFile=join(data,'v2-history.json');const history:DayRow[]=(await read(historyFile))??[];
 if(process.argv.includes('--history')){for(const line of historyTable(history,Number(process.argv.find(a=>a.startsWith('--days='))?.slice(7)??14)))console.log(line);return;}
 if(!process.argv.includes('--no-write')){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  // What the agent's desk holds, read from the answers the cycle has checked.
  let agent:AgentCounts|null=null;
  const checked=await read(join(data,'agent','answers','verified.json')) as {verified:boolean|null}[]|null;
  if(Array.isArray(checked))agent={answers:checked.length,verified:checked.filter(r=>r.verified===true).length,unverified:checked.filter(r=>r.verified===false).length,undecided:checked.filter(r=>r.verified==null).length};
  // What the gate on the server decided so far. Unreadable is left unknown, never written as zero.
  let gate:GateCounts|null=null;
  try{
   const {parse}=await import('dotenv');for(const [key,value] of Object.entries(parse(readFileSync(join(process.cwd(),'.env.local'),'utf8'))))process.env[key]??=value;
   const {createServerSupabase}=await import('../src/lib/supabase/server');
   const {data:rows,error}=await (createServerSupabase() as unknown as {from(table:string):{select(columns:string):PromiseLike<{data:{status:string;reason:string|null}[]|null;error:{message:string}|null}>}}).from('pipeline_proposals').select('status,reason');
   if(error)throw Error(error.message);
   const count=(test:(row:{status:string;reason:string|null})=>boolean)=>(rows??[]).filter(test).length;
   gate={applied:count(r=>r.status==='applied'),held:count(r=>r.status==='held'),rejected:count(r=>r.status==='rejected'&&!r.reason?.startsWith('rolled_back')),superseded:count(r=>r.status==='superseded'),rolledBack:count(r=>Boolean(r.reason?.startsWith('rolled_back')))};
  }catch(e){if(!process.argv.includes('--summary'))console.warn(`Stav brány nezjištěn: ${(e as Error).message.slice(0,120)}`);}
  try{writeFileSync(`${historyFile}.${process.pid}.tmp`,JSON.stringify(withDay(history,dayRow(day,summary,{gate,agent})),null,1),{mode:0o600});renameSync(`${historyFile}.${process.pid}.tmp`,historyFile);}catch(e){console.warn(`Denní čísla se nepodařilo uložit: ${(e as Error).message}`);}
 }
 if(process.argv.includes('--summary')){console.log(JSON.stringify(summary,null,2));return;}
 if(process.argv.includes('--json'))console.log(JSON.stringify({...status,summary},null,2));
 else {
  const mark={green:'ZELENÁ',yellow:'ŽLUTÁ',orange:'ORANŽOVÁ',red:'ČERVENÁ'}[summary.tone];
  console.log(`${mark}: ${summary.headline}`);
  console.log(`Za 24 h: ${summary.delivered.newRaces24h} nových závodů, ${summary.delivered.updatedRaces24h} doplněných, ${summary.mac.cycles24h} průchodů. Za 7 dní: ${summary.delivered.newRaces7d} nových, ${summary.delivered.updatedRaces7d} doplněných. Zadrženo: ${summary.heldRaces??'?'} nových závodů.`);
  // How many of last season's races already have their next edition, by country: the closest measure of coverage there is.
  const editions=await read(join(data,'edition-coverage.json'));
  if(editions?.byCountry){
   const pct=(a:number,b:number)=>b?`${Math.round(100*a/b)} %`:'–';
   const trend=(editions.history??[]).slice(-7);const first=trend[0];
   console.log(`Ročník ${editions.season} už mají: ${editions.withEdition} z ${editions.races} loňských závodů (${pct(editions.withEdition,editions.races)})${first&&first.day!==trend.at(-1).day?`, za ${trend.length} dní ${editions.withEdition-first.withEdition>=0?'+':''}${editions.withEdition-first.withEdition}`:''}.`);
   console.log('  '+Object.entries(editions.byCountry as Record<string,{races:number;withEdition:number}>).sort((a,b)=>b[1].races-a[1].races).map(([c,v])=>`${c} ${v.withEdition}/${v.races} (${pct(v.withEdition,v.races)})`).join(' · '));
  }
  // What the calendars offer against what the catalogue holds (weekly, a slice of the sources each time).
  const yielded=await read(join(data,'source-yield-latest.json'));
  if(yielded?.checked){
   type Row={url:string;offered:number;matched:number;notPublic:unknown[];missing:unknown[];note:string};
   const rows=yielded.checked as Row[];const sum=(f:(r:Row)=>number)=>rows.reduce((n,r)=>n+f(r),0);
   const offered=sum(r=>r.offered),held=sum(r=>r.matched),notPublic=sum(r=>r.notPublic.length),missing=sum(r=>r.missing.length);
   console.log(`Kalendáře (${String(yielded.checkedAt).slice(0,10)}, ${rows.length} zdrojů): nabízejí ${offered} nadcházejících závodů, v katalogu je ${held}, ${notPublic} čeká na zveřejnění, ${missing} se nikdy nedostalo dovnitř; ${rows.filter(r=>r.note).length} zdrojů nejde přečíst.`);
   const gaps=await read(join(data,'source-yield-gaps.json'));
   if(gaps)console.log(`  z toho skutečné mezery: ${gaps.gaps.length} (jinde už držíme ${gaps.dropped.held_nearby}, mimo záběr ${gaps.dropped.not_covered}); adresy jdou do discovery.`);
   for(const r of rows.filter(r=>r.missing.length).sort((a,b)=>b.missing.length-a.missing.length).slice(0,3))console.log(`  chybí ${String(r.missing.length).padStart(3)} z ${r.offered}: ${r.url.slice(0,70)}`);
  }
  const dates=await read(join(data,'date-proposals-latest.json'));
  if(dates)console.log(`Změny data a zrušení (${String(dates.at).slice(0,16).replace('T',' ')}): ${dates.changed} v kopii, ${dates.ready} s citací by šlo odeslat (zatím jen náhled), ${dates.waiting} čeká${Object.keys(dates.reasons??{}).length?` (${Object.entries(dates.reasons as Record<string,number>).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k} ${v}`).join(', ')})`:''}.`);
  const sent=await read(join(data,'date-send-latest.json'));
  if(sent){const {at,apply,considered,log,...counts}=sent;console.log(`Změny data odeslané na server (${String(at).slice(0,16).replace('T',' ')}, ${considered} závodů${apply?'':', jen náhled'}): ${Object.entries(counts).map(([k,v])=>`${k} ${v}`).join(', ')||'nic'}.`);}
  const rd=await read(join(data,'regulation-disagreements-latest.json'));
  if(rd)console.log(`Propozice × záznam (${String(rd.at).slice(0,16).replace('T',' ')}, ${rd.checked} závodů): rozpor v místě ${rd.place}, v zemi ${rd.country}, ve dnech programu ${rd.dates}.`);
  const ai=await read(join(data,'llm-budget.json'));
  if(ai?.steps){
   const month=new Date().toISOString().slice(0,7);const perStep:Record<string,number>={};
   for(const [day,steps] of Object.entries(ai.steps as Record<string,Record<string,number>>))if(day.startsWith(month))for(const [step,usd] of Object.entries(steps))perStep[step]=(perStep[step]??0)+usd;
   const spent=Object.values(perStep).reduce((a,b)=>a+b,0);
   if(spent>0)console.log(`AI po krocích (${month}, ${spent.toFixed(2)} USD z ${(ai.months?.[month]??0).toFixed(2)} celkem): ${Object.entries(perStep).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v.toFixed(2)}`).join(', ')}`);
  }
  if(summary.heldBacklog)console.log(`Čeká na člověka: ${summary.heldBacklog.actionable} závodů, nejstarší ${summary.heldBacklog.oldestDays} dní; dalších ${summary.heldBacklog.past} je po termínu a nikdo je nerozhoduje.`);
  for(const s of summary.stuck)console.log(`  ${s.step}: ${s.stopped?'ZASTAVENO, ':''}${s.outcome}${s.reason?` (${s.reason})`:''} od ${s.since.slice(0,16).replace('T',' ')}, za 24 h ${s.attempts24h}×${s.failures?`, ${s.failures}. selhání v řadě`:''}${s.nextTryAt?`, další pokus ${s.nextTryAt.slice(0,16).replace('T',' ')}`:''}`);
  console.log(`Mac zdarma: ${status.runner?'běží':'NEBĚŽÍ'}; panel: ${status.panel?'běží':'zavřený'}; poslední hlášení před ${status.heartbeatAgeSeconds??'?'} s`);
  console.log(`Stav: ${monitor?.status??'neznámý'}; poslední výsledek: ${JSON.stringify(monitor?.lastResult?{at:monitor.lastResult.at,reads:monitor.lastResult.reads,created:monitor.lastResult.created,updated:monitor.lastResult.updated,failed:monitor.lastResult.failed}:null)}`);
  console.log(`Server zdarma: ${monitor?.server?.error??monitor?.server?.checkedAt??'zatím neověřeno'}`);
  if(!process.env.SEARXNG_URL){try{const {parse}=await import('dotenv');for(const [key,value] of Object.entries(parse(readFileSync(join(process.cwd(),'.env.local'),'utf8'))))process.env[key]??=value;}catch{}}
  const searxngHealth=await checkSearxngHealth(2000);
  const utcDay=now.toISOString().slice(0,10);
  const searxngBudget=await read(join(data,'searxng-search-budget.json')) as {days?:Record<string,number>}|null;
  const serperBudget=await read(join(data,'serper-search-budget.json')) as {days?:Record<string,number>}|null;
  const searxngToday=searxngBudget?.days?.[utcDay]??0;
  const serperToday=serperBudget?.days?.[utcDay]??0;
  const searxngState=!searxngHealth.configured?'není nastaven':searxngHealth.ok?'běží':`NEDOSTUPNÝ — zkontroluj Colima/Docker${searxngHealth.error?` (${searxngHealth.error})`:''}`;
  console.log(`Vyhledávání: SearXNG ${searxngState}; dnes dotazů: SearXNG ${searxngToday}, Serper ${serperToday}`);
  console.log(`Starý ČSC plán: ${status.legacyAgent?'POZOR, aktivní':'vypnutý'}; podrobnosti: docs/keep-fresh.md`);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
