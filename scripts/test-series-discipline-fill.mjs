import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const series = "00000000-0000-0000-0000-000000000001";
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table events(id uuid primary key,slug text,name text,start_date date,end_date date,status text default 'scheduled',visibility text default 'public',merged_into_id uuid,location_id uuid,series_id uuid,disciplines text[],last_seen_at timestamptz,updated_at timestamptz);
    create table locations(id uuid primary key,name text,municipality text,country_code text,lat float,lng float,updated_at timestamptz);
    create table series(id uuid primary key,name text,disciplines text[],visibility text,source_url text,website_url text);
    create table event_overrides(event_id uuid primary key,locked_fields text[]);
    create table event_facts(event_id uuid,field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text);
    grant usage on schema public to service_role; grant all on all tables in schema public to service_role;`);
  for (const file of ["20261102084307_durable_publication_tasks.sql", "20261103133246_atomic_series_discipline_fill.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(`set role service_role; insert into series values('${series}','Fixture MTB',array['mtb'],'public','https://fixture.test/series',null);`);
  for (let n = 10; n <= 19; n++) {
    await db.query("insert into events(id,name,slug,start_date,series_id,disciplines) values($1,'Fixture',$2,current_date+1,$3,'{}')", [id(n), `fixture-${n}`, series]);
  }
  await db.exec(`insert into event_overrides values('${id(11)}',array['disciplines']);
    update events set disciplines=array['road'] where id='${id(12)}';
    update events set merged_into_id='${id(10)}' where id='${id(13)}';
    update events set visibility='hidden' where id='${id(14)}';
    update events set start_date=current_date-1 where id='${id(15)}';
    update events set status='cancelled' where id='${id(16)}';
    update events set series_id=null where id='${id(17)}';
    update events set status='registration_open' where id='${id(19)}';`);
  const fill = async (limit = 3000) => (await db.query("select pipeline_fill_series_disciplines($1) r", [limit])).rows[0].r;
  const state = async () => (await db.query(`select jsonb_build_object('events',(select jsonb_agg(to_jsonb(e) order by id) from events e),'facts',(select jsonb_agg(to_jsonb(f) order by event_id) from event_facts f),'tasks',(select jsonb_agg(to_jsonb(t) order by key) from pipeline_tasks t)) r`)).rows[0].r;
  const initial = await state();
  assert.deepEqual(await fill(0), { filled: 0 }); assert.deepEqual(await state(), initial);
  await assert.rejects(fill(-1), /Invalid discipline batch limit/);
  await db.exec(`reset role; create function reject_evidence() returns trigger language plpgsql as $$begin raise exception 'forced provenance failure';end$$;
    create trigger reject_evidence before insert on event_facts for each row execute function reject_evidence(); set role service_role;`);
  const beforeFailure = await state();
  await assert.rejects(fill(), /forced provenance failure/);
  assert.deepEqual(await state(), beforeFailure, 'failed evidence must roll back race and publication tasks');
  await db.exec('reset role; drop trigger reject_evidence on event_facts; set role service_role');
  assert.deepEqual(await fill(1), { filled: 1 });
  assert.deepEqual(await fill(), { filled: 2 });
  const after = await state();
  for (const n of [10, 18, 19]) {
    assert.deepEqual(after.events.find(e => e.id === id(n)).disciplines, ['mtb']);
    const fact = after.facts.find(f => f.event_id === id(n));
    assert.equal(fact.field, 'disciplines'); assert.deepEqual(fact.value, ['mtb']); assert.deepEqual(fact.previous, []);
    assert.equal(fact.source_url, 'https://fixture.test/series'); assert.match(fact.quote, /not independently confirmed/);
    assert.notEqual(after.events.find(e => e.id === id(n)).public_revision, initial.events.find(e => e.id === id(n)).public_revision);
  }
  for (let n = 11; n <= 17; n++) assert.deepEqual(after.events.find(e => e.id === id(n)), initial.events.find(e => e.id === id(n)));
  assert.deepEqual(await fill(), { filled: 0 }); assert.deepEqual(await state(), after, 'replay creates no evidence or publication churn');
  await db.exec(`update events set disciplines='{}' where id='${id(10)}'; update series set visibility='hidden' where id='${series}'`);
  assert.deepEqual(await fill(), { filled: 0 });
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role}`); await assert.rejects(fill(), /permission denied/);
  }
  console.log('PASS: atomic field/provenance/publication, locks, existing data, merged/hidden/past/cancelled races, active registrations, bounded batch, hidden series, idempotence, rollback on evidence failure, private access');
} finally { await db.close(); }
