/** Read-only status from the one installed collector; no second/manual loop. */
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const read=async(p:string)=>{try{return JSON.parse(await readFile(p,'utf8'));}catch{return null;}};
async function main(){
 const base=join(homedir(),'Library/Application Support/LetsRace');
 const installation=await read(join(base,'installation.json'));
 const data=installation?.data??join(base,'data');
 const monitor=await read(join(data,'monitor.json'));
 const live=(label:string)=>{try{return /state = running/.test(execFileSync('launchctl',['print',`gui/${process.getuid!()}/${label}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch{return false;}};
 const status={at:new Date().toISOString(),installation,runner:live('cz.letsrace.runner'),panel:live('cz.letsrace.monitor'),legacyAgent:live('cz.letsrace.ingest-csc'),heartbeatAgeSeconds:monitor?.at?Math.round((Date.now()-Date.parse(monitor.at))/1000):null,monitor};
 if(process.argv.includes('--json'))console.log(JSON.stringify(status,null,2));
 else {
  console.log(`Mac zdarma: ${status.runner?'běží':'NEBĚŽÍ'}; panel: ${status.panel?'běží':'zavřený'}; poslední hlášení před ${status.heartbeatAgeSeconds??'?'} s`);
  console.log(`Stav: ${monitor?.status??'neznámý'}; poslední výsledek: ${JSON.stringify(monitor?.lastResult?{at:monitor.lastResult.at,reads:monitor.lastResult.reads,created:monitor.lastResult.created,updated:monitor.lastResult.updated,failed:monitor.lastResult.failed}:null)}`);
  console.log(`Server zdarma: ${monitor?.server?.error??monitor?.server?.checkedAt??'zatím neověřeno'}`);
  console.log(`Starý ČSC plán: ${status.legacyAgent?'POZOR, aktivní':'vypnutý'}; podrobnosti: docs/keep-fresh.md`);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
