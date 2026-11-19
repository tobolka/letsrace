import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import {createServerSupabase} from '../../src/lib/supabase/server';
Object.assign(process.env,parse(await readFile('.env.local','utf8')));
const db=createServerSupabase();
async function all(table:string, select='*'){const rows:any[]=[];for(let n=0;;n+=500){const {data,error}=await (db as any).from(table).select(select).order('id').range(n,n+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
const match=/(feminin|moravia.*divide|kozovaz|brdsk.*meandr|race.*across.*czech|moraviadivide\.eu|raceacross\.cz|krakono|cyklomaraton|mtbo|paradise|trojmez|may.divide|lost.ride|oremon|wineyard|bousov|pr[aá]žsk|pra[zž]sky|tourdefeminin|tourdekozovazy|bike-meandr)/i;
const events=await all('events','*,location:locations(*),sources:event_sources(*),categories:event_categories(*),overrides:event_overrides(*)');
const cz2027=events.filter(e=>e.start_date.startsWith('2027')&&e.location?.country_code==='CZ');
const related=events.filter(e=>match.test(JSON.stringify([e.name,e.website_url,e.sources])));
const result:any={capturedAt:new Date().toISOString(),cz2027,related,events};
for(const t of ['pipeline_candidates','discovered_links','watched_urls'])result[t]=(await all(t)).filter(r=>match.test(JSON.stringify(r)));
await writeFile('reports/cz-2027-verification-2026-10-29/baseline.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({cz2027:cz2027.length,related:related.map(e=>({id:e.id,name:e.name,date:e.start_date,end:e.end_date,visibility:e.visibility,status:e.status,merged:e.merged_into_id,place:e.location?.name,disciplines:e.disciplines,categories:e.categories,overrides:e.overrides,website:e.website_url,registration:e.registration_url})),candidates:result.pipeline_candidates.map((x:any)=>({id:x.id,status:x.status,name:x.payload?.name})),watches:result.watched_urls.map((x:any)=>({id:x.id,url:x.url,status:x.status,added_by:x.added_by})),links:result.discovered_links},null,2));
