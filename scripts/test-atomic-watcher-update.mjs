import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,race=id(1),other=id(2);
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,name text,slug text,name_normalized text,season text,start_date date,end_date date,status text,visibility text,merged_into_id uuid,location_id uuid,disciplines text[],fingerprint text constraint events_fingerprint_key unique,last_seen_at timestamptz,updated_at timestamptz);
 create table locations(id uuid primary key,name text);
 create table event_overrides(event_id uuid primary key,locked_fields text[]);
 create table event_facts(id uuid default gen_random_uuid(),event_id uuid,field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text,model text);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261102084307_durable_publication_tasks.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261103134148_atomic_watcher_update.sql','utf8'));
 await db.exec(`set role service_role;insert into events(id,name,slug,fingerprint,start_date,status,visibility) values('${race}','Race','race','original',current_date+1,'scheduled','public'),('${other}','Other race','other','owned-by-other',current_date+2,'scheduled','public');`);
 const state=async()=>(await db.query(`select jsonb_build_object('events',(select jsonb_agg(to_jsonb(e)order by id) from events e),'facts',(select jsonb_agg(to_jsonb(f)order by id) from event_facts f),'tasks',(select jsonb_agg(to_jsonb(t)order by key)from pipeline_tasks t)) r`)).rows[0].r;
 const revision=async()=>(await state()).events.find(e=>e.id===race).public_revision;
 const update=async(patch,rev)=> (await db.query('select pipeline_update_watcher_event($1,$2,$3,$4) r',[race,rev??await revision(),patch,{sourceUrl:'https://fixture.test/race',quote:'Official race information'}])).rows[0].r;
 const initial=await state(),oldRevision=await revision();
 assert.equal((await update({name:'New name'})).changed,true);
 let current=await state();assert.equal(current.facts.length,1);assert.equal(current.facts[0].previous,'Race');assert.equal(current.facts[0].value,'New name');assert.equal(current.facts[0].source_url,'https://fixture.test/race');
 assert.notEqual(current.events.find(e=>e.id===race).public_revision,oldRevision);
 const beforeStale=await state();await assert.rejects(update({name:'Stale name'},oldRevision),/concurrent_event_update/);assert.deepEqual(await state(),beforeStale);
 assert.equal((await update({name:'New name'})).changed,false);assert.deepEqual(await state(),beforeStale,'same value does not create history or public tasks');
 const collision=await update({name:'Same identity',fingerprint:'owned-by-other'});assert.equal(collision.retainedKey,true);assert.equal(collision.applied.fingerprint,undefined);
 current=await state();assert.equal(current.events.find(e=>e.id===race).fingerprint,'original');assert.deepEqual(current.events.find(e=>e.id===other),initial.events.find(e=>e.id===other));
 await db.exec(`insert into event_overrides values('${race}',array['name','start_date'])`);
 const locked=await state();const lockResult=await update({name:'Wrong',start_date:'2027-01-01',name_normalized:'wrong',season:'2027',fingerprint:'wrong'});assert.deepEqual(lockResult.applied,{});assert.deepEqual(await state(),locked);
 await db.exec(`delete from event_overrides;reset role;create function reject_fact()returns trigger language plpgsql as $$begin raise exception 'forced evidence failure';end$$;create trigger reject_fact before insert on event_facts for each row execute function reject_fact();set role service_role;`);
 const beforeFailure=await state();await assert.rejects(update({name:'Unrecorded change',disciplines:['mtb']}),/forced evidence failure/);assert.deepEqual(await state(),beforeFailure,'field/history/publication all roll back');
 await db.exec('reset role;drop trigger reject_fact on event_facts;set role service_role');
 await assert.rejects(update({id:other}),/Unsupported watcher field/);
 await db.exec(`update events set merged_into_id='${other}' where id='${race}'`);await assert.rejects(update({name:'Resurrected'}),/identity_review_required/);
 assert.equal((await db.query("select pipeline_source_state('error','concurrent_event_update: changed') s")).rows[0].s,'deferred');
 for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(update({name:'Attack'},oldRevision),/permission denied/);}
 console.log('PASS: typed update/history/publication transaction, stale revision refusal, unchanged replay, fingerprint-owner preservation, live manual locks and derived fields, rollback on evidence failure, allowed fields, merged-event guard, automatic deferral, private access');
}finally{await db.close();}
