import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),id='00000000-0000-0000-0000-000000000001';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text,visibility text,merged_into_id uuid,location_id uuid);
 create table locations(id uuid primary key);
 create table watched_urls(id uuid primary key,url text,kind text,status text,next_poll_at timestamptz);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 for(const suffix of ['_durable_publication_tasks.sql','_shared_source_work_leases.sql']){const file=(await readdir('supabase/migrations')).find(file=>file.endsWith(suffix));assert(file);await db.exec(await readFile('supabase/migrations/'+file,'utf8'));}
 await db.exec(`set role service_role;insert into watched_urls values('${id}','https://race.test/','race','active',now());`);
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
 for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(claim(),/permission denied/);}
 console.log('PASS: shared source lease, exclusion, preserved schedule, pause, browser capability, expired worker and private RPCs');
}finally{await db.close();}
