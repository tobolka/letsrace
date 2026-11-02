import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const event='00000000-0000-0000-0000-000000000001',user='00000000-0000-0000-0000-000000000002',claim='00000000-0000-0000-0000-000000000003';
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text,visibility text,merged_into_id uuid,series_id uuid,location_id uuid,website_url text,registration_url text,regulations_url text,registration_closes_at timestamptz,description text,updated_at timestamptz);
 create table locations(id uuid primary key,name text,municipality text,updated_at timestamptz);
 create table series(id uuid primary key,slug text);
 create table event_series(event_id uuid,series_id uuid);
 create table organizer_claims(id uuid primary key,user_id uuid,status text,event_id uuid,series_id uuid);
 create table event_categories(id uuid primary key default gen_random_uuid(),event_id uuid,name text,distance_km float8,age_min integer,age_max integer,audience text);
 create table event_overrides(event_id uuid unique,fields jsonb,locked_fields text[],updated_by text,updated_at timestamptz);
 create table event_sources(event_id uuid,source_url text,kind text);
 create table organizer_edits(id uuid primary key default gen_random_uuid(),claim_id uuid,user_id uuid,event_id uuid,field text,previous jsonb,value jsonb);
 grant usage on schema public to service_role;grant all on all tables in schema public to service_role;`);
 await db.exec(await readFile('supabase/migrations/20261102084307_durable_publication_tasks.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261102140700_reliable_detail_data.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261102142802_weather_history_period_refresh.sql','utf8'));
 await db.exec(`set role service_role;insert into events(id,slug,name,start_date,end_date,status,visibility) values('${event}','test-race','Test race','2027-06-04','2027-06-04','scheduled','public');insert into organizer_claims values('${claim}','${user}','verified','${event}',null);insert into event_categories(event_id,name,distance_km,audience) values('${event}','Main route',70,'adults');`);
 const edit=async(changes,categories=null)=>(await db.query('select organizer_apply_edit($1,$2,$3,$4,$5) as value',[event,claim,user,changes,categories])).rows[0].value;
 const snapshot=async()=>(await db.query(`select (select to_jsonb(e) from events e) as event,(select jsonb_agg(to_jsonb(c)) from event_categories c) as categories,(select count(*)::int from organizer_edits) as edits,(select to_jsonb(o) from event_overrides o) as locks`)).rows[0];
 const before=await snapshot();
 const result=await edit({description:'New details'},[{name:'Main route',distanceKm:75,ageMin:15,ageMax:18}]);
 assert.equal(result.changed,2);
 const after=await snapshot();assert.equal(after.categories[0].id,before.categories[0].id);assert.equal(after.categories[0].audience,'adults');assert.equal(after.categories[0].distance_km,75);assert.notEqual(after.event.public_revision,before.event.public_revision);assert.deepEqual(after.locks.locked_fields.toSorted(),['categories','description']);
 assert.equal((await edit({description:'New details'},[{name:'Main route',distanceKm:75,ageMin:15,ageMax:18}])).changed,0);
 await assert.rejects(edit({start_date:'2027-06-05'}),/invalid_date_range/);assert.deepEqual(await snapshot(),after);
 await assert.rejects(edit({visibility:'private'}),/unsupported_field/);
 // Fail late, after rows and history have changed: every part must roll back.
 await db.exec(`reset role;alter table event_overrides add constraint fail_test check(not(fields ? 'registration_url')) not valid;set role service_role`);
 await assert.rejects(edit({registration_url:'https://entry.test'},[]),/fail_test/);assert.deepEqual(await snapshot(),after);
 await db.exec(`update organizer_claims set status='revoked' where id='${claim}'`);await assert.rejects(edit({description:'No'}),/organizer_access_denied/);
 // A failed refresh keeps the last good historical snapshot.
 const take=async(lat=5000)=>(await db.query('select weather_history_claim($1,1400,2025,$2) as token',[lat,['05-10']])).rows[0].token;
 const finish=async(token,summary,error=null)=>(await db.query('select weather_history_finish(5000,1400,$1,2025,$2,$3) as ok',[token,summary,error])).rows[0].ok;
 const token=await take();assert(token);assert.equal(await take(),null);assert.equal(await finish(user,{},'wrong lease'),false);
 assert.equal(await finish(token,{'05-10':{tmax:20,years:10,referenceYear:2025},'06-10':{tmax:21,years:10,referenceYear:2025}}),true);assert.equal(await take(),null);
 const retry=(await db.query("select weather_history_claim(5000,1400,2026,array['05-10']) as token")).rows[0].token;
 assert.equal(await finish(retry,null,'upstream unavailable'),true);
 const cached=(await db.query("select weather_history_read(5000,1400,'05-10') as value")).rows[0].value;assert.equal(cached.climate.tmax,20);assert.equal(cached.referenceYear,2025);assert.equal(await take(),null);
 // Updating one period cannot erase or relabel the other period's older snapshot.
 await db.exec("update weather_history set next_attempt_at=now() where lat_cell=5000");
 const advance=(await db.query("select weather_history_claim(5000,1400,2026,array['05-10']) as token")).rows[0].token;
 assert((await db.query("select weather_history_finish(5000,1400,$1,2026,$2,null) as ok",[advance,{'05-10':{tmax:22,referenceYear:2026}}])).rows[0].ok);
 const older=(await db.query("select weather_history_read(5000,1400,'06-10') as value")).rows[0].value;
 assert.equal(older.referenceYear,2025);assert.equal(older.climate.tmax,21);
 assert((await db.query("select weather_history_claim(5000,1400,2026,array['06-10']) as token")).rows[0].token);
 for(let i=0;i<8;i++) assert(await take(100+i));assert.equal(await take(300),null);
 for(const role of ['anon','authenticated']) {
  await db.exec(`reset role;set role ${role}`);
  await assert.rejects(db.query('select * from weather_history'),/permission denied/);
  await assert.rejects(take(),/permission denied/);
  await assert.rejects(edit({}),/permission denied/);
 }
 console.log('PASS: atomic edits, preserved category IDs, locks/history rollback, revocation, durable history, failure retention, exclusive leases, shared daily cap and private access');
} finally { await db.close(); }
