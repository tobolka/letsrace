import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';import{PGlite}from'../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),race='00000000-0000-0000-0000-000000000001',a='00000000-0000-0000-0000-000000000002',b='00000000-0000-0000-0000-000000000003';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,location_id uuid,series_id uuid,last_seen_at timestamptz,updated_at timestamptz);
 create table locations(id uuid primary key,name text,municipality text,country_code text,lat float,lng float,updated_at timestamptz);
 create table series(id uuid primary key,name text,slug text,visibility text default 'public',website_url text,source_url text,age_categories text[],last_seen_at timestamptz,updated_at timestamptz);
 create table event_overrides(event_id uuid primary key,locked_fields text[]);
 create table event_facts(event_id uuid,field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 for(const f of ['20261102084307_durable_publication_tasks.sql','20261102201557_aggregate_catalogue_publication.sql','20261103090530_separate_public_refresh_requests.sql','20261103130304_durable_series_publication.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const fs=await import('node:fs/promises');const file=(await fs.readdir('supabase/migrations')).find(f=>f.includes('event_series'));
 const membership=await readFile('supabase/migrations/'+file,'utf8');await db.exec(membership.slice(0,membership.indexOf('-- Merges')));
 await db.exec('grant all on event_series to service_role');
 await db.exec(await readFile('supabase/migrations/20261103131307_atomic_series_membership.sql','utf8'));
 await db.exec(`set role service_role;insert into series(id,name,slug)values('${a}','A','a'),('${b}','B','b');insert into events(id,name,slug,start_date)values('${race}','Race','race',current_date+10);`);
 const attach=async(series,primary=false,promote=false)=>(await db.query('select pipeline_attach_event_series($1,$2,$3,$4,$5) r',[race,series,primary,'fixture',promote])).rows[0].r.status;
 const state=async()=>(await db.query(`select jsonb_build_object('event',(select to_jsonb(e)from events e where id='${race}'),'links',(select jsonb_agg(to_jsonb(l)order by series_id)from event_series l),'facts',(select jsonb_agg(to_jsonb(f))from event_facts f),'tasks',(select jsonb_agg(to_jsonb(t) order by key)from pipeline_tasks t)) r`)).rows[0].r;
 assert.equal(await attach(a,false,true),'attached');assert.equal((await state()).event.series_id,a);
 const first=await state();assert.equal(await attach(a,false,true),'unchanged');assert.deepEqual(await state(),first);
 assert.equal(await attach(b,false,true),'attached');assert.equal((await state()).event.series_id,a);assert.equal((await state()).links.filter(l=>l.is_primary).length,1);
 await db.exec(`insert into event_overrides values('${race}',array['series_id'])`);const locked=await state();assert.equal(await attach(b,true),'locked');assert.deepEqual(await state(),locked);
 await db.exec(`delete from event_overrides;reset role;create function reject_fact()returns trigger language plpgsql as $$begin raise exception 'forced evidence failure';end$$;create trigger reject_fact before insert on event_facts for each row execute function reject_fact();set role service_role;`);
 const prior=await state();await assert.rejects(attach(b,true),/forced evidence failure/);assert.deepEqual(await state(),prior);
 await db.exec('reset role;drop trigger reject_fact on event_facts;set role service_role');assert.equal(await attach(b,true),'attached');assert.equal((await state()).event.series_id,b);assert.equal((await state()).links.filter(l=>l.is_primary).length,1);
 await db.exec(`update events set merged_into_id=gen_random_uuid() where id='${race}'`);assert.equal(await attach(a,true),'merged');
 for(const role of['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(attach(a,true),/permission denied/);}
 console.log('PASS: atomic badge/memberships/history/outbox, one primary, idempotent retries, secondary association, manual lock, evidence failure rollback, merged protection, private access');
}finally{await db.close();}
