import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import {createServerSupabase} from '../../src/lib/supabase/server';
import {ingestReviewedCandidate} from '../../src/lib/watcher/run';
import {recordFacts} from '../../src/lib/catalog/facts';
import {saveCandidate} from '../../src/lib/discovery/review';
import {fingerprint} from '../../src/lib/domain';
import {createHash} from 'node:crypto';
const root='reports/cz-2027-verification-2026-10-29';
Object.assign(process.env,parse(await readFile('.env.local','utf8')));
process.env.CATALOG_OVERVIEW_ONLY='1';process.env.LLM_CALENDARS='0';
const db=createServerSupabase();
const manifest:any[]=JSON.parse(await readFile(root+'/manifest.json','utf8'));
const baseline=JSON.parse(await readFile(root+'/baseline.json','utf8'));
const geo=JSON.parse(await readFile(root+'/geocodes.json','utf8'));
geo.Javorník={lat:50.3923374,lng:17.0052268,countryCode:'CZ',displayName:'Javorník, okres Jeseník — Nominatim independent verification'};
geo.Kozovazy=geo['Kozovazy, Vyšehořovice'];geo['Tři Dvory']=geo['Tři Dvory, okres Kolín'];
geo['Hradec Králové']={lat:50.20346,lng:15.89233,countryCode:'CZ',displayName:'Kemp Stříbrný rybník — official Bulletin2 p6'};
geo.Sedlejov={lat:49.2296292,lng:15.4924747,countryCode:'CZ',displayName:'Sportovní areál Sedlejov — official2027 regulations'};
let cookie='';
async function admin(body:any){
 if(!cookie){const r=await fetch('https://letsrace.cz/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})});if(!r.ok)throw Error('Admin authentication failed');cookie=r.headers.get('set-cookie')!.split(';')[0];}
 const r=await fetch('https://letsrace.cz/api/admin/events',{method:'PATCH',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});if(!r.ok)throw Error('Admin edit failed: '+r.status+' '+await r.text());return r.json();
}
async function get(id:string):Promise<any>{const {data,error}=await db.from('events').select('*,location:locations(*),categories:event_categories(*),sources:event_sources(*),overrides:event_overrides(*)').eq('id',id).single();if(error)throw error;return data;}
const apply=process.argv.includes('--apply');
const results:any[]=JSON.parse(await readFile(root+'/results.json','utf8').catch(()=> '[]'));
for(const r of manifest){
 if(results.some(x=>x.key===r.key&&x.complete))continue;
 if(results.some(x=>x.key===r.key&&!x.complete))throw Error('Interrupted write requires readback reconciliation: '+r.key);
 const before=r.expectedId?await get(r.expectedId):null;
 if(before&&before.merged_into_id)throw Error('Target already merged: '+r.key);
 const orig=baseline.events.find((x:any)=>x.id===r.expectedId);
 if(before&&orig&&['name','start_date','end_date','visibility','status'].some(k=>before[k]!==orig[k])&&!r.mergeId)throw Error('Concurrent change: '+r.key);
 if(r.action==='unchanged'){if(!before||before.start_date!==r.start||before.end_date!==r.end)throw Error('Existing data mismatch '+r.key);results.push({key:r.key,id:before.id,action:'unchanged',before,after:before,complete:true});await writeFile(root+'/results.json',JSON.stringify(results,null,2));continue;}
 const coords=geo[r.city]??before?.location;
 if(r.action!=='provisional'&&(!coords||coords.lat==null||coords.lng==null))throw Error('Unverified geocode '+r.city);
 if(!apply){console.log('DRY',r.action,r.key,r.expectedId??'new',coords?.lat,coords?.lng);continue;}
 let id=r.expectedId,created=false;
 // Every operation is checkpointed after readback; stop on failures, never claim a partial write succeeded.
 const log:any={key:r.key,id,action:r.action,before,complete:false};results.push(log);await writeFile(root+'/results.json',JSON.stringify(results,null,2));
 if(r.mergeId){
  const {data:drop,error:de}=await db.from('events').select('*').eq('id',r.mergeId).single();if(de)throw de;
  if(!drop.merged_into_id){const {error}=await db.rpc('app_merge_events',{keep_id:id,drop_id:r.mergeId});if(error)throw error;log.mergedId=r.mergeId;}
  // Correct the authoritative day using the existing admin mechanism and lock it before further readers.
  await admin({id,startDate:r.start,endDate:r.end,lockFields:true});
 }
 if(r.action==='provisional'){
  await admin({id,status:'tbc',visibility:'hidden',lockFields:true});
 }else if(r.manual){
  await admin({id,disciplines:r.disc,visibility:'public',registrationUrl:r.registration,lockFields:true});
 }else{
  const event:any={externalId:'verified-cz2027-'+r.key,name:r.name,startDate:r.start,endDate:r.end,placeText:r.city,countryHint:'CZ',discipline:r.disc.filter((x:string)=>x!=='mtbo'),audience:'mixed',sourceUrl:r.source,websiteUrl:r.source,confidence:1,lat:coords.lat,lng:coords.lng,eventType:r.eventType??'race',categories:r.categories??[],...(r.registration?{registrationUrl:r.registration}:{}),...(r.regulations?{regulationsUrl:r.regulations}:{}),...(r.opens?{registrationOpensAt:r.opens}:{}),...(r.closes?{registrationClosesAt:r.closes}:{}),evidence:{sourceUrl:r.source,quote:r.quote,method:'independent_primary_source_review',version:'cz-2027-2026-10-29'}};
  const raw=r.snapshot?await readFile(root+'/sources/'+r.snapshot+'.html','utf8'):r.quote+'\n'+r.notes;
  const candidate=await saveCandidate(db,event,{sourceUrl:r.source,documentHash:createHash('sha256').update(raw).digest('hex'),reason:'Explicit user-authorized independent official-source review. '+r.notes,country:'CZ'});
  const {data:queued,error:qe}=await db.from('pipeline_candidates').select('id,evidence_hash,status').eq('candidate_key',candidate.candidate_key).eq('evidence_hash',candidate.evidence_hash).single();if(qe)throw qe;
  const decision={id:queued.id,evidenceHash:queued.evidence_hash,action:'publish',expectedEventId:id??null,authority:r.authority??'official',checked:{identity:true,date:true,place:true,discipline:true,authority:true},reason:r.notes};
  const {error:claim}=await db.from('pipeline_candidates').update({status:'publishing',decision}).eq('id',queued.id).eq('status','pending');if(claim)throw claim;
  const result=await ingestReviewedCandidate(event,{sourceUrl:r.source,authority:r.authority??'official',expectedEventId:id??null,watchedUrlId:null});id=result.id;created=result.created;log.id=id;log.created=created;await writeFile(root+'/results.json',JSON.stringify(results,null,2));
  const {error:finish}=await db.from('pipeline_candidates').update({status:'published',event_id:id,decision,updated_at:new Date().toISOString()}).eq('id',queued.id);if(finish)throw finish;
 }
 // Explicitly preserve manual decisions against old source assertions; merge with all pre-existing locks.
 if(r.action!=='provisional') await admin({id,startDate:r.start,endDate:r.end,disciplines:r.disc,lockFields:true});
 let after:any=await get(id);
 // Elevations are supported by category rows but the regular watcher only fills the core category fields.
 for(const c of r.categories??[]){
  let held=after.categories.find((x:any)=>x.name===c.name&&(c.distanceKm==null||x.distance_km===c.distanceKm));
  if(!held){const {data,error}=await db.from('event_categories').insert({event_id:id,name:c.name,distance_km:c.distanceKm??null,audience:c.audience??'mixed',elevation_m:c.elevationM??null}).select('*').single();if(error)throw error;held=data;}
  else if(c.elevationM!=null&&held.elevation_m==null){const {error}=await db.from('event_categories').update({elevation_m:c.elevationM}).eq('id',held.id);if(error)throw error;}
 }
 // Country/region and map coordinates describe the verified meeting town, not an invented start line.
 if(after.location?.id&&r.action!=='provisional'){
  const updates:any={region:r.region};
  if(r.key==='v4') { /* existing verified town coordinates stay */ }
  const {error}=await db.from('locations').update(updates).eq('id',after.location.id);if(error)throw error;
 }
 // Maintain the identity fingerprint after the existing admin date editor.
 const fp=fingerprint({name:after.name,startDate:r.start,lat:after.location?.lat,lng:after.location?.lng});
 if(after.fingerprint!==fp){const {error}=await db.from('events').update({fingerprint:fp}).eq('id',id);if(error)throw error;}
 const override=after.overrides;
 const extraLocks:any={...(r.eventType?{event_type:r.eventType}:{}),...(r.opens?{registration_opens_at:after.registration_opens_at}:{}),...(r.closes?{registration_closes_at:after.registration_closes_at}:{}),...(r.categories?.length?{categories:r.categories}:{})};
 if(Object.keys(extraLocks).length){const {error}=await db.from('event_overrides').upsert({event_id:id,fields:{...(override?.fields??{}),...extraLocks},locked_fields:[...new Set([...(override?.locked_fields??[]),...Object.keys(extraLocks)])],updated_by:override?.updated_by??'admin',updated_at:new Date().toISOString()},{onConflict:'event_id'});if(error)throw error;}
 after=await get(id);
 const sourceFacts:any[]=[{field:'source_evidence',value:{audit:'cz-2027-2026-10-29',verification:'independent_primary_sources',source:r.source,additionalSources:r.otherSources??[],notes:r.notes,discrepancy:r.conflict??null,registrationStatus:r.registrationStatus,eventType:r.eventType??'race',startTime:({moravia:'08:15',racz:'08:00',seven:'08:30',oremon:'08:30'} as Record<string,string>)[r.key],dateStatus:r.action==='provisional'?'provisional':'confirmed',routes:r.categories??[],geocoding:coords},previous:null,sourceUrl:r.source,quote:r.quote}];
 if(before)for(const k of ['start_date','end_date','status','visibility','disciplines','website_url','registration_url','location_id'])if(JSON.stringify(before[k])!==JSON.stringify(after[k]))sourceFacts.push({field:k,value:after[k],previous:before[k],sourceUrl:r.source,quote:r.quote});
 if(JSON.stringify(before?.categories??[])!==JSON.stringify(after.categories))sourceFacts.push({field:'event_categories',value:{rows:after.categories},previous:{rows:before?.categories??[]},sourceUrl:r.source,quote:r.quote});
 await recordFacts(db,id,sourceFacts,{method:'manual_verified_official',version:'cz-2027-2026-10-29'});
 if(after.start_date!==r.start||r.action!=='provisional'&&after.end_date!==r.end||!after.overrides)throw Error('Readback mismatch '+r.key);
 if(before&&after.slug!==before.slug)throw Error('Stable slug changed '+r.key);
 if(r.action==='provisional'&&(after.status!=='tbc'||after.visibility!=='hidden'))throw Error('Provisional still public');
 log.after=after;log.complete=true;log.created=created;await writeFile(root+'/results.json',JSON.stringify(results,null,2));console.log('APPLIED',r.key,id,created?'created':'updated');
}
console.log('COMPLETE',{apply,complete:results.filter(x=>x.complete).length});
