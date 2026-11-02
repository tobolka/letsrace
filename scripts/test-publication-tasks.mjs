/** Real PostgreSQL semantics in an isolated in-memory database; no production writes. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const id='00000000-0000-0000-0000-000000000001',place='00000000-0000-0000-0000-000000000002';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,location_id uuid,last_seen_at timestamptz,updated_at timestamptz,website_url text);
 create table locations(id uuid primary key,name text,municipality text,updated_at timestamptz);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 const migration=(await readdir('supabase/migrations')).find(name=>name.endsWith('_durable_publication_tasks.sql'));
 assert(migration);await db.exec(await readFile(`supabase/migrations/${migration}`,'utf8'));
 await db.exec(`set role service_role;insert into locations(id,name) values('${place}','Hronov');insert into events(id,slug,name,start_date,location_id) values('${id}','race-2027','Race','2027-08-28','${place}');`);
 const task=async()=>(await db.query('select * from pipeline_tasks')).rows[0];
 const revision=async()=>(await db.query('select public_revision from events')).rows[0].public_revision;
 const first=await revision();assert.equal((await task()).payload.revision,first);
 await db.exec(`update events set last_seen_at=now(),updated_at=now() where id='${id}'`);assert.equal(await revision(),first);
 await db.exec(`update events set start_date='2027-08-29' where id='${id}'`);assert.notEqual(await revision(),first);assert.equal((await db.query('select count(*)::int as n from pipeline_tasks')).rows[0].n,1);
 await db.exec("update pipeline_tasks set available_at=now()-interval '1 second'");
 assert.equal((await db.query("select * from pipeline_claim_tasks('public_refresh',array['http'],10)")).rows.length,0);
 const claim=async()=>(await db.query("select * from pipeline_claim_tasks('public_refresh',array['web'],10)")).rows[0];
 let held=await claim();assert(held.token);assert.equal(await claim(),undefined);
 const finish=async(t)=>(await db.query('select pipeline_finish_task($1,$2,$3,$4) as ok',[t.key,t.token,t.payload,{verified:true}])).rows[0].ok;
 assert.equal(await finish({...held,token:'00000000-0000-0000-0000-000000000099'}),false);
 await db.exec(`update events set slug='renamed-race' where id='${id}'`);assert.equal(await finish(held),false);assert.equal((await task()).status,'pending');assert.deepEqual((await task()).payload.previousSlugs,['race-2027']);
 held=await claim();assert.equal(await finish(held),true);assert.equal(await finish(held),false);
 await db.exec(`update locations set municipality='Hronov' where id='${place}'`);assert.equal((await task()).status,'pending');
 held=await claim();await db.exec("update pipeline_tasks set lease_until=now()-interval '1 second'");const next=await claim();assert.notEqual(next.token,held.token);assert.equal(await finish(held),false);assert.equal(await finish(next),true);
 assert.equal((await db.query("select outcome from pipeline_task_attempts where token=$1",[held.token])).rows[0].outcome,'lease_expired');
 // Unknown outcomes consume budget too; a crash cannot reset the daily cap.
 await db.exec("insert into pipeline_task_attempts(token,task_key,kind) select gen_random_uuid(),'public:"+id+"','public_refresh' from generate_series(1,60)");
 await db.exec("update pipeline_tasks set status='pending',available_at=now()-interval '1 second'");assert.equal(await claim(),undefined);
 // If saving the outbox fails, the event modification must roll back too.
 await db.exec("reset role;alter table pipeline_tasks add constraint reject_change check(payload->'expected'->>'name'<>'Rejected change') not valid;set role service_role");
 await assert.rejects(db.exec(`update events set name='Rejected change' where id='${id}'`),/reject_change/);
 assert.equal((await db.query('select name from events')).rows[0].name,'Race');
 for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select * from pipeline_tasks'),/permission denied/);await assert.rejects(claim(),/permission denied/);}
 console.log('PASS: transactional outbox, coalescing, heartbeat exclusion, capabilities, exclusive leases, expired-worker recovery, superseded revisions, rename history, location propagation, rollback and private access');
}finally{await db.close();}
