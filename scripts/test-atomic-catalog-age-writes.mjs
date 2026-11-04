import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const event = "00000000-0000-4000-8000-000000000101";
const series = "00000000-0000-4000-8000-000000000102";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table locations(id uuid primary key);
    create table series(id uuid primary key,updated_at timestamptz,age_categories_confirmed_at timestamptz,age_categories text[]);
    create table events(id uuid primary key,slug text,name text,status text,visibility text,start_date date,end_date date,
      merged_into_id uuid,location_id uuid,series_id uuid,age_categories text[],age_confidence text,audience text,
      registration_opens_at timestamptz,registration_closes_at timestamptz,website_url text,regulations_url text,updated_at timestamptz);
    create table event_overrides(event_id uuid references events,locked_fields text[]);
    create table event_facts(event_id uuid,field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text);
    grant all on all tables in schema public to service_role;
  `);
  for (const file of ["20261102084307_durable_publication_tasks.sql","20261104082050_atomic_catalog_age_writes.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  }
  await db.exec(`set role service_role;
    insert into series values ('${series}', now(), now(), array['u15']);
    insert into events(id,slug,name,status,visibility,start_date,series_id) values
      ('${event}','race','Race','scheduled','public',current_date+2,'${series}');`);
  const agePatch = { age_categories: ["u15"], age_confidence: "explicit", audience: "youth" };
  const revision = async () => (await db.query("select public_revision from events")).rows[0].public_revision;
  const apply = async (rev, patch = agePatch, method = "regulation_ages", parent = null, updated = null) => (await db.query(
    "select pipeline_apply_catalogue_age_read($1,$2,$3,$4,$5,$6,$7,$8,$9) as revision",
    [event,rev,patch,method,"atomic-v1","https://fixture.test/rules","U15",parent,updated],
  )).rows[0].revision;
  const old = await revision();
  await db.exec("update events set website_url='https://changed.test'");
  const fresh = await revision();
  assert.equal(await apply(old),null);
  await db.query("insert into event_overrides values($1,array['audience'])",[event]);
  assert.equal(await apply(fresh),null);
  await db.exec("delete from event_overrides");
  const parentRevision = (await db.query("select updated_at from series")).rows[0].updated_at;
  assert.equal(await apply(fresh,agePatch,"confirmed_series",series,new Date(0)),null);
  assert.equal(await apply(fresh,{...agePatch,age_categories:["elite"]},"confirmed_series",series,parentRevision),null);

  await db.exec(`reset role; create function fail_evidence() returns trigger language plpgsql as $$begin raise exception 'evidence unavailable'; end$$;
    create trigger fail_evidence before insert on event_facts for each row execute function fail_evidence(); set role service_role;`);
  const tasks = async () => (await db.query("select key,payload from pipeline_tasks order by key")).rows;
  const before = await tasks();
  await assert.rejects(apply(fresh),/evidence unavailable/);
  assert.equal(await revision(),fresh);
  assert.deepEqual(await tasks(),before);
  await db.exec("reset role; drop trigger fail_evidence on event_facts; set role service_role");
  const saved = await apply(fresh);
  assert.ok(saved && saved!==fresh);
  assert.equal(await apply(saved,{...agePatch,age_categories:["elite"]}),null);
  await assert.rejects(apply(saved,{location_id:series}),/Invalid catalogue age read patch/);
  assert.equal((await db.query("select count(*)::int as n from event_facts")).rows[0].n,3);
  await db.exec("reset role; set role anon");
  await assert.rejects(apply(saved),/permission denied/);
  console.log("PASS: stale revision, coupled manual locks, current series proof, rollback, explicit categories, outbox and private RPC");
} finally {
  await db.close();
}
