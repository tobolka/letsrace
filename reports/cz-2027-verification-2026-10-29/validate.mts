import {readFile,writeFile} from 'node:fs/promises';import {parse} from 'dotenv';import {createServerSupabase} from '../../src/lib/supabase/server';import {fingerprint} from '../../src/lib/domain';import {recordFacts} from '../../src/lib/catalog/facts';import {saveCandidate} from '../../src/lib/discovery/review';import {matchesDisciplineFilter,canonicalEventDisciplines} from '../../src/lib/taxonomy';import {PUBLIC_EVENT_STATUSES} from '../../src/lib/event-visibility';import {createHash} from 'node:crypto';
const root='reports/cz-2027-verification-2026-10-29';Object.assign(process.env,parse(await readFile('.env.local','utf8')));const db=createServerSupabase();const results:any[]=JSON.parse(await readFile(root+'/results.json','utf8'));const manifest:any[]=JSON.parse(await readFile(root+'/manifest.json','utf8'));const checks:any[]=[];
async function check(ok:boolean,name:string){checks.push({name,ok});if(!ok)throw Error(name);}
for(const r of results){const {data:e,error}=await db.from('events').select('*,location:locations(*),categories:event_categories(*),sources:event_sources(*),overrides:event_overrides(*)').eq('id',r.id).single();if(error)throw error;const ev:any=e;const m=manifest.find(x=>x.key===r.key);
 if(r.action==='merged'){await check(Boolean(ev.merged_into_id)&&ev.visibility==='hidden','merged alias '+r.id);r.after=e;continue;}
 if(!m)throw Error('Missing manifest '+r.key);
 if(r.before)await check(ev.slug===r.before.slug,'stable URL '+r.key);
 await check(ev.start_date===m.start,'start '+r.key);
 if(!['provisional','excluded'].includes(m.action))await check(ev.end_date===m.end,'end '+r.key);
 if(m.action==='provisional')await check(ev.status==='tbc'&&ev.visibility==='hidden','not confirmed '+r.key);
 if(m.action==='excluded')await check(ev.visibility==='hidden','excluded '+r.key);
 if(m.action==='create'||m.action==='update'){
  await check(ev.timezone==='Europe/Prague','timezone '+r.key);
  await check(ev.location?.country_code==='CZ','country '+r.key);
  if(r.key!=='south')await check(ev.location?.lat>=48.5&&ev.location?.lat<=51.1&&ev.location?.lng>=12&&ev.location?.lng<=19,'CZ map pin '+r.key);
  else await check(ev.location?.lat==null&&ev.location?.lng==null,'no invented stage location');
  await check((m.disc??[]).every((d:string)=>ev.disciplines.includes(d)),'disciplines '+r.key);
  if(m.disc?.includes('mtbo'))await check(matchesDisciplineFilter(ev.disciplines,['mtb']),'MTBO in MTB filter '+r.key);
  if(m.eventType)await check(ev.event_type===m.eventType,'event type '+r.key);
  if(m.categories)for(const c of m.categories)await check(ev.categories.some((x:any)=>x.name===c.name&&(c.distanceKm==null||x.distance_km===c.distanceKm)&&(c.elevationM==null||x.elevation_m===c.elevationM)),'category '+r.key+' '+c.name);
  // Keep display identity and lookup identity consistent after admin edits and merges.
  const fp=fingerprint({name:ev.name,startDate:ev.start_date,lat:ev.location?.lat,lng:ev.location?.lng});
  if(ev.fingerprint!==fp){const {error}=await db.from('events').update({fingerprint:fp}).eq('id',ev.id);if(error)throw error;await recordFacts(db,ev.id,[{field:'fingerprint',value:fp,previous:ev.fingerprint,sourceUrl:m.source,quote:m.quote??null}],{method:'manual_verified_official',version:'cz-2027-2026-10-29'});ev.fingerprint=fp;}
 }
 r.after=ev;
}
await writeFile(root+'/results.json',JSON.stringify(results,null,2));
// Keep unresolved dates/venue concerns in the real review queue, linked to stable existing IDs.
for(const r of manifest.filter(x=>x.action==='provisional')){
 const event:any={externalId:'review-cz2027-'+r.key,name:r.name,startDate:r.start,placeText:r.city||'Česko — místo bude oznámeno',countryHint:'CZ',discipline:r.disc,sourceUrl:r.source,websiteUrl:r.source,confidence:.5,evidence:{quote:r.quote,sourceUrl:r.source,method:'manual_primary_source_review',version:'cz-2027-2026-10-29'}};
 const candidate=await saveCandidate(db,event,{sourceUrl:r.source,documentHash:createHash('sha256').update(r.quote+'\n'+r.notes).digest('hex'),reason:'Provisional date or edition: '+r.notes,country:'CZ'});
 const {error}=await db.from('pipeline_candidates').update({status:'waiting',event_id:r.expectedId,decision:{action:'wait',reason:r.notes}}).eq('candidate_key',candidate.candidate_key).eq('evidence_hash',candidate.evidence_hash);if(error)throw error;
}
const {data:dups,error:de}=await db.from('events').select('id,name,start_date,visibility,merged_into_id').gte('start_date','2027-01-01').lt('start_date','2028-01-01').or('name.ilike.%feminin%,name.ilike.%moravia%divide%,name.ilike.%kozovaz%,name.ilike.%meandr%,name.ilike.%race%across%czech%,name.ilike.%wineyards%,name.ilike.%krakono%,name.ilike.%pohár%mtbo%,name.ilike.%evropy%mtbo%');if(de)throw de;
const {data:hist,error:he}=await (db as any).from('pipeline_merge_history').select('id,keep_id,drop_id,created_at').gte('created_at','2026-10-29T00:00:00Z').in('drop_id',['134db97e-dd3d-4d2f-8f83-46d2227bf684','1feea986-a0a6-4bb0-9f9e-d34d387ff21b','9c101e44-2b4d-4aac-ab94-f425ab1f39c9']);
if(he){console.log('Merge history query needs schema reconciliation:',he.message);}else await writeFile(root+'/merge-recovery.json',JSON.stringify(hist,null,2));
const report={checkedAt:new Date().toISOString(),checks,mtboUi:{stored:['mtb','mtbo'],displayed:canonicalEventDisciplines(['mtb','mtbo']),standaloneMtboFilterAvailable:false},duplicateReadback:dups,summary:{inspected:manifest.length,created:results.filter(x=>x.created).length,updated:results.filter(x=>!x.created&&['update','provisional','excluded'].includes(x.action)).length,unchanged:results.filter(x=>x.action==='unchanged').length,merged:results.filter(x=>x.action==='merged').length+(results.some(x=>x.mergedId)?1:0)}};
await writeFile(root+'/validation.json',JSON.stringify(report,null,2));
// An authenticated normal admin edit refreshes the public catalogue after the reviewed DB supplements.
const login=await fetch('https://letsrace.cz/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})});if(!login.ok)throw Error('Login failed');const cookie=login.headers.get('set-cookie')!.split(';')[0];
const refresh=await fetch('https://letsrace.cz/api/admin/events',{method:'PATCH',headers:{'content-type':'application/json',cookie},body:JSON.stringify({id:'a73eb9a5-46de-4bbe-b9d7-1e141a026314',visibility:'public',lockFields:true})});if(!refresh.ok)throw Error('Public catalogue refresh failed');
console.log(report.summary,'checks',checks.length,'all passed');
