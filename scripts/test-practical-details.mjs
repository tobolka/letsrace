import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),id='00000000-0000-0000-0000-000000000001',place='00000000-0000-0000-0000-000000000002';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,location_id uuid,last_seen_at timestamptz,updated_at timestamptz,website_url text);
 create table locations(id uuid primary key,name text,municipality text,venue text,updated_at timestamptz);
 create table event_overrides(event_id uuid primary key,locked_fields text[]);
 create table event_facts(id uuid default gen_random_uuid(),event_id uuid,field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261102084307_durable_publication_tasks.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261103075455_practical_race_details.sql','utf8'));
 await db.exec(`set role service_role;insert into locations(id,name,venue) values('${place}','Town','Real venue');insert into events(id,slug,name,start_date,location_id) values('${id}','race-2027','Race','2027-05-01','${place}');insert into event_overrides values('${id}',array['location_id']);`);
 const row=async()=>(await db.query('select * from events')).rows[0];
 const save=async(details,revision)=>{revision??=(await row()).public_revision;return (await db.query('select pipeline_save_practical_details($1,$2,$3) value',[id,revision,details])).rows[0].value;};
 const fact={value:{name:'Real venue',streetAddress:'Stated 40',precision:'venue'},sourceUrl:'https://race.test/contact',quote:'Where is the race? Real venue, Stated 40',checkedAt:'2026-11-03T08:00:00Z',editionYear:2027,status:'year_neutral'};
 const before=await row();assert.deepEqual((await save({venue:fact})).changed,['venue']);const after=await row();assert.notEqual(after.public_revision,before.public_revision);
 assert.equal((await db.query('select count(*)::int n from event_facts')).rows[0].n,1);
 assert.equal((await db.query("select payload->'expected'->'practical_details'->'venue'->'value'->>'streetAddress' value from pipeline_tasks where key=$1",['public:'+id])).rows[0].value,'Stated 40');
 assert.deepEqual((await save({venue:{...fact,checkedAt:'2026-11-04T08:00:00Z'}})).changed,[]);assert.equal((await row()).public_revision,after.public_revision);
 assert.equal((await save({venue:fact},before.public_revision)).status,'changed');
 assert.deepEqual((await save({venue:{...fact,value:{...fact.value,name:'Another venue'}}})).skipped,['venue']);
 await assert.rejects(save({fees:{...fact,value:[],status:'year_neutral'}}),/Invalid practical fact/);
 await assert.rejects(save({venue:{...fact,editionYear:2026}}),/Invalid practical fact/);
 await assert.rejects(save({venue:{value:fact.value,editionYear:2027}}),/Invalid practical fact/);
 // Audit and public value are one transaction, including outbox failure.
 await db.exec("reset role;alter table event_facts add constraint reject_fact check(field<>'practical.organizer') not valid;set role service_role;");
 await assert.rejects(save({organizer:{...fact,value:{name:'Club'},status:'current'}}),/reject_fact/);assert.equal((await row()).practical_details.organizer,undefined);
 for(const role of ['anon','authenticated']) {await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select pipeline_save_practical_details($1,$2,$3)',[id,after.public_revision,{}]),/permission denied/);}
 console.log('PASS: per-field evidence, atomic audit/outbox, no reread churn, race-version concurrency, location lock, old-edition rejection, failed-audit rollback and private writes');
} finally {await db.close();}
