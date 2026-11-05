import { readFileSync,writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { findNextEdition,findPreviousEdition,type EditionIdentity } from '../src/lib/catalog/edition-identity';
import { createServerSupabase } from '../src/lib/supabase/server';
async function main(){
 for(const[k,v]of Object.entries(parse(readFileSync('.env.local'))))process.env[k]??=v;
 const db=createServerSupabase();const rows:EditionIdentity[]=[];let after: string|undefined;
 for(let page=0;page<4;page++){
  const {data,error}=await db.rpc('public_edition_candidates',{p_country:'DE',p_from:'2020-01-01',p_until:'2033-01-01',p_after:after});
  if(error)throw error;rows.push(...data as EditionIdentity[]);if(data.length<1000)break;after=data.at(-1)!.id;
 }
 const original=<T extends EditionIdentity>(event:EditionIdentity,candidates:T[],yearsAhead=1):T|null=>{
  const pool:EditionIdentity[]=candidates.some(row=>row.id===event.id)?candidates:[...candidates,event];const offset=365*(yearsAhead-1);
  const matches=candidates.filter(candidate=>{const days=(Date.parse(candidate.start_date)-Date.parse(event.start_date))/86400000;return days>=300+offset&&days<=430+offset&&findPreviousEdition(candidate,pool,yearsAhead)?.id===event.id;});
  return matches.length===1?matches[0]!:null;
 };
 const samples=rows.filter(r=>r.start_date.startsWith('2026')).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,30);
 const test=(read:typeof original)=>{const start=performance.now();const results=samples.flatMap(event=>Array.from({length:5},(_,i)=>read(event,rows,i+1)?.id??null));return {milliseconds:performance.now()-start,results};};
 const before=test(original),afterResult=test(findNextEdition);if(JSON.stringify(before.results)!==JSON.stringify(afterResult.results))throw Error('Edition results differ');
 const result={kind:'offline comparison on a current public German catalogue snapshot',rows:rows.length,sampleRaces:samples.length,forwardYearChecks:before.results.length,beforeMs:Math.round(before.milliseconds),afterMs:Math.round(afterResult.milliseconds),sameResults:true,links:before.results.filter(Boolean).length,limits:'One country and one sample; this is not billed Vercel CPU or a measured site-wide saving.'};
 writeFileSync('reports/productive-cycle-2026-11-05/edition-benchmark.json',JSON.stringify(result,null,2));console.log(result);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
