import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),id='00000000-0000-0000-0000-000000000001';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text,visibility text,merged_into_id uuid,location_id uuid);
 create table locations(id uuid primary key);
 create table watched_urls(id uuid primary key,url text,kind text,status text,next_poll_at timestamptz,updated_at timestamptz default now(),calendar_write_progress jsonb,content_hash text,
 etag text,last_modified text,http_status integer,last_error text,last_extract_status text,last_fetched_at timestamptz,last_changed_at timestamptz);
 create table ingest_runs(id uuid primary key,watched_url_id uuid,finished_at timestamptz,ok boolean,error text,events_upserted int,
 links_discovered int,strategy text,http_status int,metrics jsonb);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 for(const suffix of ['_durable_publication_tasks.sql','_shared_source_work_leases.sql','_commit_source_read_atomically.sql']){const file=(await readdir('supabase/migrations')).find(file=>file.endsWith(suffix));assert(file);await db.exec(await readFile('supabase/migrations/'+file,'utf8'));}
 await db.exec(`set role service_role;insert into watched_urls(id,url,kind,status,next_poll_at) values('${id}','https://race.test/','race','active',now());`);
 const claim=async(caps=['http'])=>(await db.query('select * from pipeline_claim_source($1,$2)',[id,caps])).rows[0];
 const task=async()=>(await db.query('select * from pipeline_tasks')).rows[0];
 let held=await claim();assert(held.token);assert.equal(await claim(),undefined);
 await db.exec(`update watched_urls set next_poll_at=now()+interval '7 days' where id='${id}'`);
 assert.equal((await task()).status,'running');
 const finish=async(t)=>(await db.query('select pipeline_finish_source($1,$2,$3,$4) as ok',[t.key,t.token,'https://race.test/',{ok:true,created:2}])).rows[0].ok;
 assert.equal(await finish(held),true);assert.equal((await task()).status,'pending');assert(Date.parse((await task()).available_at)>Date.now()+6*86400000);
 held=await claim();await db.exec(`update watched_urls set status='paused' where id='${id}'`);assert.equal(await finish(held),true);assert.equal((await task()).status,'blocked');assert.equal(await claim(),undefined);
 await db.exec(`update watched_urls set status='active',url='https://portal.czechcyclingfederation.com/Races' where id='${id}'`);assert.equal(await claim(),undefined);
 held=await claim(['http','browser']);assert(held.token);await db.exec("update pipeline_tasks set lease_until=now()-interval '1 second'");const recovered=await claim(['browser']);assert(recovered.token!==held.token);assert.equal(await finish(held),false);
 await finish(recovered);
 await db.exec(`update watched_urls set next_poll_at=now()-interval '1 minute',updated_at=clock_timestamp() where id='${id}'`);
 const claimRead=async(due=null,revision=null)=>(await db.query('select * from pipeline_claim_source_read($1,$2,$3,$4)',[id,['browser'],due,revision])).rows[0];
 const runId=n=>`00000000-0000-0000-0000-00000000000${n}`;
 for(const n of [2,3,4]) await db.query('insert into ingest_runs(id,watched_url_id) values($1,$2)',[runId(n),id]);
 const commit=async(t,n,patch)=>(await db.query('select pipeline_commit_source_read($1,$2,$3,$4,$5,$6,$7,$8) ok',
   [t.key,t.token,t.payload.url,t.payload.sourceRevision,runId(n),patch,{ok:true,metrics:{},events_upserted:0,links_discovered:0},{ok:true}])).rows[0].ok;
 const first=await claimRead(new Date());assert(first.token);
 assert.equal(await claimRead(new Date()),undefined);
 await db.exec("update pipeline_tasks set lease_until=now()-interval '1 second'");
 const next=await claimRead(new Date());assert.notEqual(next.token,first.token);
 assert.equal(await commit(first,2,{status:'dead',content_hash:'obsolete'}),false);
 await assert.rejects(commit(next,9,{content_hash:'lost'}),/receipt missing/);
 const future=new Date(Date.now()+86400000).toISOString();
 assert.equal(await commit(next,3,{next_poll_at:future,content_hash:'fresh'}),true);
 assert.equal(await commit(first,2,{status:'dead',content_hash:'obsolete'}),false);
 assert.equal(await claimRead(new Date()),undefined);
 assert.equal((await db.query('select content_hash from watched_urls')).rows[0].content_hash,'fresh');
 assert.equal(new Date((await task()).available_at).toISOString(),future);
 assert.equal((await db.query('select count(*)::int n from ingest_runs where ok')).rows[0].n,1);
 const edited=await claimRead();
 await db.exec("update watched_urls set status='paused',updated_at=clock_timestamp()");
 assert.equal(await commit(edited,4,{status:'active',content_hash:'obsolete'}),false);
 assert.equal((await task()).status,'blocked');
 for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(claim(),/permission denied/);await assert.rejects(claimRead(),/permission denied/);await assert.rejects(commit(next,3,{}),/permission denied/);}
 console.log('PASS: shared source lease, exclusion, preserved schedule, pause, browser capability, expired worker and private RPCs');
}finally{await db.close();}
