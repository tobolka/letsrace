import {createRequire} from 'node:module'; import {readFileSync,writeFileSync} from 'node:fs'; import {homedir} from 'node:os'; import {join} from 'node:path';
import {assessDuplicate,datesCompatible} from '../../src/lib/dedup';
const require=createRequire(import.meta.url);const {psql}=require('../../scripts/local-sync.cjs');
const catalogue=JSON.parse(psql('letsrace_pass1',`select coalesce(json_agg(json_build_object('id',e.id,'name',e.name,'date',e.start_date,'end',e.end_date,'disciplines',e.disciplines,'website',e.website_url,'location',json_build_object('town',l.municipality,'country',l.country_code,'lat',l.lat,'lng',l.lng))),'[]') from events e left join locations l on e.location_id=l.id where e.visibility='public' and e.merged_into_id is null and e.start_date >= current_date-2`));
const plan=JSON.parse(readFileSync(join(homedir(),'Library/Application Support/LetsRace/data/local-pass-run/plan-new-races/plan.json'),'utf8'));
const dedup=(r:any)=>({name:r.name,startDate:r.date,endDate:r.end,disciplines:r.disciplines,urls:[r.website],placeText:r.location?.town,countryCode:r.location?.country,lat:r.location?.lat,lng:r.location?.lng});
const out=[];
for(const held of plan.newRaces.held){if(!held.because.includes('may_already_be_listed'))continue;const a=catalogue.find((x:any)=>x.name===held.name && x.date===held.date);if(!a)continue;const matches=catalogue.filter((b:any)=>b.id!==a.id&&datesCompatible({startDate:a.date,endDate:a.end},{startDate:b.date,endDate:b.end},1)).map((b:any)=>({other:b,assessment:assessDuplicate(dedup(a),dedup(b))})).filter((m:any)=>m.assessment.decision!=='distinct');out.push({held:a,matches});}
writeFileSync('reports/local-release-2026-11-05/held-matches.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out.map((r:any)=>({name:r.held.name,date:r.held.date,matches:r.matches.map((m:any)=>({name:m.other.name,date:m.other.date,decision:m.assessment.decision,assessment:m.assessment}))})),null,2));
