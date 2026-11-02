/** Isolated PostgreSQL fixture; uses the same PGlite setup as test-publication-tasks.mjs. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const id='00000000-0000-0000-0000-000000000001', place='00000000-0000-0000-0000-000000000002', series='00000000-0000-0000-0000-000000000003';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,location_id uuid,series_id uuid,last_seen_at timestamptz,updated_at timestamptz,website_url text);
 create table locations(id uuid primary key,name text,municipality text,country_code text,lat float,lng float,updated_at timestamptz);
 create table series(id uuid primary key,name text,slug text,visibility text,website_url text,age_categories text[]);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261102084307_durable_publication_tasks.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261102201557_aggregate_catalogue_publication.sql','utf8'));
 await db.exec(`set role service_role;insert into locations(id,name) values('${place}','Place');insert into series(id,name) values('${series}','Series');insert into events(id,name,slug,start_date,location_id,series_id) values('${id}','Race','race',current_date+20,'${place}','${series}');`);
 const revision=async()=>(await db.query("select payload->>'revision' as rev from pipeline_tasks where key='catalogue:upcoming'")).rows[0].rev;
 let rev=await revision();
 await db.exec(`update events set last_seen_at=now() where id='${id}'`);assert.equal(await revision(),rev);
 await db.exec(`update events set name='Renamed race' where id='${id}'`);assert.notEqual(await revision(),rev);rev=await revision();
 await db.exec(`update locations set name='Corrected venue' where id='${place}'`);assert.notEqual(await revision(),rev);rev=await revision();
 await db.exec(`update series set name='Corrected series' where id='${series}'`);assert.notEqual(await revision(),rev);
 assert.equal((await db.query("select count(*)::int n from pipeline_tasks where kind='catalogue_refresh'")).rows[0].n,1);
 const claim=async()=>(await db.query("select * from pipeline_claim_tasks('catalogue_refresh',array['web'],1)")).rows[0];
 const task=await claim();assert(task);assert.equal(await claim(),undefined);
 // A writer arriving while the batch is running cannot be lost by the finishing worker.
 await db.exec(`update events set name='Concurrent change' where id='${id}'`);
 assert.equal((await db.query('select pipeline_finish_task($1,$2,$3,$4) ok',[task.key,task.token,task.payload,{verifiedAt:'test'}])).rows[0].ok,false);
 assert.equal(await claim(),undefined);
 await db.exec("update pipeline_task_attempts set started_at=now()-interval '7 hours' where kind='catalogue_refresh'");
 const next=await claim();assert(next);assert.equal((await db.query('select pipeline_finish_task($1,$2,$3,$4) ok',[next.key,next.token,next.payload,{}])).rows[0].ok,true);
 // Failed/crashed attempts count towards the four-per-rolling-day cap too.
 await db.exec("update pipeline_task_attempts set started_at=now()-interval '7 hours' where kind='catalogue_refresh'; insert into pipeline_task_attempts(token,task_key,kind,started_at) select gen_random_uuid(),'catalogue:upcoming','catalogue_refresh',now()-interval '8 hours' from generate_series(1,2);select pipeline_enqueue_catalogue();");
 assert.equal(await claim(),undefined);
 for(const role of ['anon','authenticated']) {await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select pipeline_enqueue_catalogue()'),/permission denied/);await assert.rejects(claim(),/permission denied/);}
 console.log('PASS: transactional shared batch, coalescing, no heartbeat churn, place/series changes, current payload, exclusive claim, six-hour and four/24h caps, failed-attempt accounting, private access');
} finally {await db.close();}
