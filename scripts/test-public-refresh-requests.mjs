import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,last_seen_at timestamptz,updated_at timestamptz);
 create table locations(id uuid primary key);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261102084307_durable_publication_tasks.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261102201557_aggregate_catalogue_publication.sql','utf8').then(s=>s.slice(0,s.indexOf('create function public.pipeline_enqueue_catalogue'))));
 await db.exec(await readFile('supabase/migrations/20261103090530_separate_public_refresh_requests.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261104123851_check_only_requested_race_revisions.sql','utf8'));
 await db.exec(`set role service_role;insert into events(id,name,slug,start_date) select gen_random_uuid(),'Race '||n,'race-'||n,current_date+30 from generate_series(1,205) n;`);
 const claim=async kind=>(await db.query('select * from pipeline_claim_tasks($1,array[\'web\'],1)',[kind])).rows[0];
 assert.equal(await claim('public_refresh'),undefined,'unrequested revisions cannot consume the daily check budget');
 const task=await claim('public_expire');assert(task);assert.equal(await claim('public_expire'),undefined);
 const candidates=async token=>(await db.query('select * from pipeline_expiration_candidates($1)',[token])).rows;
 const batch=await candidates(task.token);assert.equal(batch.length,200);
 assert.equal((await db.query('select pipeline_record_expirations($1,$2) n',[task.token,batch.map(t=>({key:t.key,revision:t.payload.revision}))])).rows[0].n,200);
 assert.equal((await candidates(task.token)).length,5);
 assert.deepEqual((await db.query("select pipeline_publication_counts() c")).rows[0].c, {awaitingRequest:5,requestedAwaitingCheck:200,awaitingCheck:205});
 assert.equal((await db.query("select count(*)::integer n from pipeline_tasks where kind='public_refresh' and status='pending'")).rows[0].n,205);
 // Receipts are bound to the current revision, not just to the race ID.
 await db.exec("update pipeline_tasks set available_at=now() where kind='public_refresh'");
 const checked=await claim('public_refresh');
 assert(checked);
 assert(batch.some(row=>row.key===checked.key && row.payload.revision===checked.payload.revision));
 await db.query("update events set name='Race revised after request' where id=$1",[checked.entity_id]);
 await db.query("update pipeline_tasks set priority=10000,available_at=now() where key=$1",[checked.key]);
 const nextCheck=await claim('public_refresh');
 assert.notEqual(nextCheck.key,checked.key);
 // A concurrent new revision cannot be acknowledged using an older snapshot.
 const last=(await candidates(task.token))[0];
 await db.query("update events set name='Changed again' where id=(select entity_id from pipeline_tasks where key=$1)",[last.key]);
 assert.equal((await db.query('select pipeline_record_expirations($1,$2) n',[task.token,[{key:last.key,revision:last.payload.revision}]])).rows[0].n,0);
 assert.equal((await db.query('select pipeline_finish_task($1,$2,$3,$4) ok',[task.key,task.token,task.payload,{}])).rows[0].ok,false);
 await assert.rejects(candidates(task.token),/expired/);
 // Existing 60/day detail verification cap is unchanged.
 await db.exec("insert into pipeline_task_attempts(token,task_key,kind) select gen_random_uuid(),'publication:expire','public_refresh' from generate_series(1,60)");
 assert.equal(await claim('public_refresh'),undefined);
 await db.exec("update pipeline_task_attempts set started_at=now()-interval '2 hours' where kind='public_expire'");
 assert(await claim('public_expire'));
 await db.exec("update pipeline_task_attempts set started_at=now()-interval '2 hours' where kind='public_expire'; insert into pipeline_task_attempts(token,task_key,kind,started_at) select gen_random_uuid(),'publication:expire','public_expire',now()-interval '2 hours' from generate_series(1,2)");
 assert.equal(await claim('public_expire'),undefined);
 for(const role of ['anon','authenticated']) {await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select * from pipeline_refresh_receipts'),/permission denied/);await assert.rejects(db.query('select pipeline_record_expirations($1,$2)',[task.token,batch.map(t=>({key:t.key,revision:t.payload.revision}))]),/permission denied/);}
 console.log('PASS: bounded 200-row requests, private receipts, receipt-gated 60/day checks, four/24h and one/hour caps, concurrent revisions, expired claims, no false completion');
} finally { await db.close(); }
