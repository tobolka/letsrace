import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const watched=id(1),primary=id(2),secondary=id(3),race=id(10);
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text unique,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,location_id uuid,series_id uuid,disciplines text[],fingerprint text unique,last_seen_at timestamptz,updated_at timestamptz);
 create table locations(id uuid primary key,name text,municipality text,country_code text,lat float8,lng float8,geocode_query text,geocode_status text,timezone text,geog text,updated_at timestamptz);
 create table series(id uuid primary key,name text,slug text unique,visibility text default 'public',website_url text,source_url text,
   age_categories text[],age_categories_confirmed_at timestamptz,updated_at timestamptz,last_seen_at timestamptz,
   name_normalized text,audience_hint text,country_code text,disciplines text[],series_type text,level text,competition_type text,season text,source_kind text);
 alter table events add foreign key(series_id) references series(id);
 create table watched_urls(id uuid primary key,url text,kind text,status text,added_by text,next_poll_at timestamptz);
 create table event_overrides(event_id uuid primary key,locked_fields text[]);
 create table event_sources(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),watched_url_id uuid references watched_urls(id),source_url text,external_id text,kind text,is_canonical boolean,unique(watched_url_id,external_id));
 create table event_categories(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),name text,distance_km float8,age_min int,age_max int,audience text);
 create table event_facts(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text,model text);
 create table page_reads(url text,reader text,text_hash text,read_at timestamptz,primary key(url,reader));
 create function set_location_geog(loc_id uuid,lng float8,lat float8)returns void language sql as $$update locations set geog='test-point' where id=loc_id$$;
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;grant execute on function set_location_geog(uuid,float8,float8) to service_role;`);
 for(const file of ['20261102084307_durable_publication_tasks.sql','20261102090714_shared_source_work_leases.sql','20261102201557_aggregate_catalogue_publication.sql','20261103090530_separate_public_refresh_requests.sql','20261103130304_durable_series_publication.sql']) await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const membership=await readFile('supabase/migrations/20260917082837_event_series_membership.sql','utf8');await db.exec(membership.slice(0,membership.indexOf('-- Merges')));
 await db.exec('grant all on event_series to service_role');
 await db.exec(await readFile('supabase/migrations/20261103131307_atomic_series_membership.sql','utf8'));
 const details=await readFile('supabase/migrations/20261102140700_reliable_detail_data.sql','utf8');await db.exec(details.slice(details.indexOf('create function public.pipeline_detail_child_revision()'),details.indexOf('-- Shared historical weather')));
 await db.exec(await readFile('supabase/migrations/20261103194952_atomic_watcher_create.sql','utf8'));
 const fence=(await readdir('supabase/migrations')).find(f=>f.endsWith('_watcher_source_kind_fence.sql'));await db.exec(await readFile('supabase/migrations/'+fence,'utf8'));
 await db.exec(await readFile('supabase/migrations/20261103134148_atomic_watcher_update.sql','utf8'));
 const deps=(await readdir('supabase/migrations')).find(f=>f.endsWith('_atomic_existing_race_dependencies.sql'));await db.exec(await readFile('supabase/migrations/'+deps,'utf8'));
 await db.exec(`set role service_role;insert into watched_urls values('${watched}','https://fixture.test/','federation','active',null,now());insert into series(id,name,slug)values('${primary}','Main','main'),('${secondary}','Additional','additional');`);
 await db.exec(`reset role;create table discovered_links(id uuid primary key default gen_random_uuid(),url text,status text);grant all on discovered_links to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261025142103_pipeline_candidate_review.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261103202930_atomic_candidate_publication.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261103204138_atomic_watcher_evidence_bundle.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261103212133_fence_deferred_candidate_retries.sql','utf8'));
 await db.exec('set role service_role');
 await db.exec(`reset role;alter table events add column registration_url text;create table event_plan_changes(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),kind text,fingerprint text,payload jsonb,unique(event_id,kind,fingerprint));grant all on event_plan_changes to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261103204237_durable_plan_change_notices.sql','utf8'));
 await db.exec('set role service_role');
 await db.exec('reset role');
 await db.exec(await readFile('supabase/migrations/20261104083715_atomic_watcher_series_plans.sql','utf8'));
 await db.exec('set role service_role');
 const source={watchedUrlId:watched,kind:'federation',event:{externalId:'initial',sourceUrl:'https://fixture.test/race',name:'Race',startDate:'2027-05-01'}};
 await db.query('select pipeline_create_watcher_event($1,$2,$3,$4,$5,false,null,$6,$7,null)',[race,{name:'Race',slug:'race',start_date:'2027-05-01',fingerprint:'race-key',series_id:primary,disciplines:['xco']},source,'a'.repeat(40),`source-evidence-v1:${watched}:initial:${race}`,[{name:'Elite',distance_km:20}],[]]);
 const incoming={...source,event:{...source.event,externalId:'additional',startDate:'2027-06-01'}};
 const tables=['series','events','event_sources','event_categories','event_facts','page_reads','event_series','pipeline_tasks','pipeline_task_attempts','event_plan_changes'];
 const state=async()=>{const out={};for(const t of tables)out[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows.map(x=>x.r);return out;};
 const revision=async()=>(await db.query('select public_revision from events where id=$1',[race])).rows[0].public_revision;
 const write=async(opts={})=>(await db.query('select pipeline_update_watcher_bundle($1,$2,$3,$4,$5,$6,$7,$8,false) r',[race,opts.revision??await revision(),opts.patch??{start_date:'2027-06-01'},opts.evidence??{sourceUrl:'https://fixture.test/race'},opts.source??incoming,'b'.repeat(40),`source-evidence-v1:${watched}:${(opts.source??incoming).event.externalId}:${race}`,opts.categories??[{name:'Kids',distance_km:.2}]])).rows[0].r;
 // Late category failure rolls back fields, history, sources, read checkpoint and notice task.
 await db.exec(`reset role;create function fail_category()returns trigger language plpgsql as $$begin if new.name='Kids' then raise exception 'category failure';end if;return new;end$$;create trigger fail_category before insert on event_categories for each row execute function fail_category();set role service_role;`);
 const before=await state();await assert.rejects(write(),/category failure/);assert.deepEqual(await state(),before);
 await db.exec('reset role;drop trigger fail_category on event_categories;drop function fail_category();set role service_role');
 const stale=await revision();const receipt=await write();assert.equal(receipt.changed,true);
 const after=await state();assert.equal(after.event_sources.length,2);assert.equal(after.event_categories.length,2);
 const tasks=after.pipeline_tasks.filter(t=>t.kind==='plan_changes');assert.equal(tasks.length,1);assert.equal(tasks[0].payload.before.startDate,'2027-05-01');assert.equal(tasks[0].payload.after.startDate,'2027-06-01');
 await assert.rejects(write({revision:stale,patch:{name:'Stale'}}),/concurrent_event_update/);assert.deepEqual(await state(),after);
 // A source identity owned elsewhere never gets stolen, even after core update runs.
 await db.exec(`insert into events(id,slug,name,start_date,fingerprint)values('${id(11)}','other','Other','2027-06-01','other-key');insert into event_sources(event_id,watched_url_id,external_id)values('${id(11)}','${watched}','foreign')`);
 const foreign={...incoming,event:{...incoming.event,externalId:'foreign'}};const beforeForeign=await state();await assert.rejects(write({source:foreign,patch:{name:'Wrong owner'}}),/source belongs/);assert.deepEqual(await state(),beforeForeign);
 // Locked fields produce notices only for the applied change, never the proposal.
 await db.exec(`insert into event_overrides values('${race}',array['start_date','categories'])`);
 const existingKids=(await db.query("select id from event_categories where event_id=$1 and name='Kids'",[race])).rows[0].id;
 assert.equal((await write({patch:{start_date:'2027-07-01'},categories:[{id:existingKids,name:'Kids',distance_km:99}]})).changed,false);
 assert.equal((await db.query("select count(*)::int n from pipeline_tasks where kind='plan_changes'")).rows[0].n,1);
 assert.equal((await db.query('select distance_km from event_categories where id=$1',[existingKids])).rows[0].distance_km,.2);
 await db.exec('delete from event_overrides');
 // Source lease expiry protects the complete bundle, not only the core fields.
 const claim=(await db.query("select * from pipeline_claim_source($1,array['http'])",[watched])).rows[0];
 await db.exec(`update pipeline_tasks set lease_until=now()-interval '1 second' where key='source:${watched}'`);
 const lost=await state();await assert.rejects(write({evidence:{sourceUrl:'https://fixture.test/race',sourceKind:'federation',lease:{key:claim.key,token:claim.token,url:'https://fixture.test/'}}}),/source lease lost/);assert.deepEqual(await state(),lost);
 // Notice creation and task completion are inseparable, including a late logging failure.
 const job=(await db.query("select * from pipeline_claim_tasks('plan_changes',array['web'],10)")).rows[0];
 const changes=[{kind:'date',fingerprint:'date:2027-05-01:2027-06-01',payload:{from:'2027-05-01',to:'2027-06-01'}}];
 const finish=async(token=job.token)=>(await db.query('select pipeline_finish_plan_changes($1,$2,$3,$4) r',[job.key,token,job.payload,changes])).rows[0].r;
 await db.exec(`reset role;create function fail_attempt()returns trigger language plpgsql as $$begin if new.outcome='done' and new.kind='plan_changes' then raise exception 'attempt failure';end if;return new;end$$;create trigger fail_attempt before update on pipeline_task_attempts for each row execute function fail_attempt();set role service_role;`);
 const beforeFinish=await state();await assert.rejects(finish(),/attempt failure/);assert.deepEqual(await state(),beforeFinish);
 await db.exec('reset role;drop trigger fail_attempt on pipeline_task_attempts;drop function fail_attempt();set role service_role');
 assert.equal(await finish(),true);assert.equal(await finish(),false);assert.equal((await db.query('select count(*)::int n from event_plan_changes')).rows[0].n,1);
 // New series and their publication tasks roll back if the race write is rejected.
 const newSeries=id(30), newRace=id(31);
 const seriesPlan={id:newSeries,slug:'new-series',create:{name:'New Series',age_categories:['elite']}};
 const newSource={...source,event:{...source.event,externalId:'new-race'}};
 const seriesWrite=async(operation,args,plans)=>(await db.query(
   'select pipeline_write_watcher_with_series($1,$2,$3) r',[operation,args,plans],
 )).rows[0].r;
 const createArgs={p_event:newRace,p_payload:{name:'New Race',slug:'new-race',start_date:'2027-05-01',fingerprint:'race-key',series_id:newSeries},
   p_source:newSource,p_hash:'c'.repeat(40),p_reader:`source-evidence-v1:${watched}:new-race:${newRace}`,
   p_reviewed:false,p_categories:[],p_secondary:[]};
 const beforeSeries=await state();
 await assert.rejects(seriesWrite('create',createArgs,[seriesPlan]),/duplicate key/);
 assert.deepEqual(await state(),beforeSeries);
 createArgs.p_payload.fingerprint='new-race-key';
 assert.equal((await seriesWrite('create',createArgs,[seriesPlan])).id,newRace);
 assert.equal((await db.query('select series_id from events where id=$1',[newRace])).rows[0].series_id,newSeries);

 // A series edit which advances the race revision succeeds after the race CAS.
 // Confirmed ages, however, survive an inferred age proposal.
 await db.exec(`update series set age_categories=array['junior'],age_categories_confirmed_at=now() where id='${primary}'`);
 const currentSeries=async()=>(await db.query('select to_jsonb(s) s from series s where id=$1',[primary])).rows[0].s;
 const metadata={id:primary,slug:'main',expected:await currentSeries(),patch:{website_url:'https://fixture.test/main',age_categories:['elite']}};
 const updateArgs={p_event:race,p_revision:await revision(),p_patch:{name:'Updated Race',series_id:primary},
   p_evidence:{sourceUrl:incoming.event.sourceUrl},p_source:incoming,p_source_hash:'d'.repeat(40),
   p_reader:`source-evidence-v1:${watched}:additional:${race}`,p_categories:[]};
 assert.equal((await seriesWrite('update',updateArgs,[metadata])).changed,true);
 const held=await currentSeries();
 assert.equal(held.website_url,metadata.patch.website_url);
 assert.deepEqual(held.age_categories,['junior']);
 const committed=await state();
 await assert.rejects(seriesWrite('update',{...updateArgs,p_revision:await revision()},[metadata]),/series changed since planning/);
 assert.deepEqual(await state(),committed);
 await assert.rejects(seriesWrite('update',updateArgs,[{...metadata,expected:held,patch:{website_url:'https://fixture.test/stale'}}]),/concurrent_event_update/);
 assert.deepEqual(await state(),committed);

 // A reviewed creation returns its saved receipt on retry, without creating a series again.
 const candidate=id(40),token=id(41),candidateRace=id(42),candidateSeries=id(43);
 const candidateSource={...source,event:{...source.event,externalId:'candidate',evidence:{sourceUrl:source.event.sourceUrl}}};
 await db.query(`insert into pipeline_candidates(id,candidate_key,evidence_hash,source_url,watched_url_id,season,payload,evidence,reason,
   status,decision,publish_token,publish_lease_until,publish_error)
   values($1,'series-candidate','proof',$2,$3,2027,$4,'{}','test','publishing','{"expectedEventId":null}',$5,now()+interval '5 minutes','retry later')`,
   [candidate,source.event.sourceUrl,watched,candidateSource.event,token]);
 const publishArgs={p_id:candidate,p_token:token,p_hash:'proof',p_event:candidateRace,p_revision:null,
   p_payload:{name:'Reviewed Race',slug:'reviewed-race',start_date:'2027-05-01',fingerprint:'reviewed-race-key',series_id:candidateSeries},
   p_source:candidateSource,p_source_hash:'e'.repeat(40),p_reader:`source-evidence-v1:${watched}:candidate:${candidateRace}`,p_categories:[],p_secondary:[]};
 const candidatePlans=[{id:candidateSeries,slug:'reviewed-series',create:{name:'Reviewed Series'}}];
 await assert.rejects(seriesWrite('publish',publishArgs,candidatePlans),/publication lease lost/);
 assert.deepEqual(await state(),committed);
 await db.query('update pipeline_candidates set publish_error=null where id=$1',[candidate]);
 const publication=await seriesWrite('publish',publishArgs,candidatePlans);
 assert.equal(publication.id,candidateRace);
 const published=await state();
 assert.deepEqual(await seriesWrite('publish',{...publishArgs,p_event:id(44)},candidatePlans),publication);
 assert.deepEqual(await state(),published);
 for(const role of ['anon','authenticated']) {await db.exec(`reset role;set role ${role}`);await assert.rejects(write(),/permission denied/);await assert.rejects(seriesWrite('create',createArgs,[seriesPlan]),/permission denied/);}
 console.log('Watcher bundle SQL: rollback of all dependencies and notice work, revision/source ownership/category locks, lost lease, atomic notice completion, series rollback, age protection and publication retry passed');
}finally{await db.close();}
