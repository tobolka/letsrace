import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table locations(id uuid primary key);
    create table events(id uuid primary key, slug text, name text, status text, visibility text,
      start_date date, end_date date, merged_into_id uuid, registration_url text, website_url text,
      location_id uuid, updated_at timestamptz);
    create table event_overrides(event_id uuid references events, locked_fields text[]);
    create table event_facts(event_id uuid, field text, value jsonb, previous jsonb, source_url text, quote text, method text, version text);
    grant all on all tables in schema public to service_role;
  `);
  for (const file of ["20261102084307_durable_publication_tasks.sql", "20261104075647_atomic_catalog_status_and_registration.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec("set role service_role");
  for (const n of [1,2,3,4,5,6,7]) {
    await db.query("insert into events(id,slug,name,start_date,status,visibility) values($1,$2,'Race',current_date+$3::int,'scheduled','public')", [id(n), `race-${n}`, n>=6 ? 2 : -2]);
  }
  await db.query("update events set status='cancelled' where id=$1", [id(2)]);
  await db.query("update events set end_date=current_date+1 where id=$1", [id(3)]);
  await db.query("update events set start_date=current_date+3 where id=$1", [id(4)]);
  await db.query("insert into event_overrides values ($1,array['status']),($2,array['registration_url'])", [id(5),id(7)]);
  const complete = async ids => (await db.query("select pipeline_complete_past_events($1,current_date) as n", [ids])).rows[0].n;
  const revision = async n => (await db.query("select public_revision from events where id=$1", [id(n)])).rows[0].public_revision;
  const register = async (n, rev) => (await db.query("select pipeline_fill_registration_link($1,$2,$3,$4,$5) as ok",
    [id(n),rev,"https://entry.test/race","https://organiser.test/race","Register"])).rows[0].ok;
  assert.equal(await complete([1,2,3,4,5].map(id)),1);
  assert.equal(await complete([id(1)]),0);
  assert.equal(await register(7,await revision(7)),false);
  const old = await revision(6);
  await db.query("update events set website_url='https://other.test' where id=$1", [id(6)]);
  assert.equal(await register(6,old),false);
  const current = await revision(6);
  await db.exec(`reset role; create function fail_evidence() returns trigger language plpgsql as $$begin raise exception 'evidence failure'; end$$;
    create trigger fail_evidence before insert on event_facts for each row execute function fail_evidence(); set role service_role;`);
  const before = (await db.query("select key,payload from pipeline_tasks order by key")).rows;
  await assert.rejects(register(6,current),/evidence failure/);
  assert.equal(await revision(6),current);
  assert.deepEqual((await db.query("select key,payload from pipeline_tasks order by key")).rows,before);
  await db.exec("reset role; drop trigger fail_evidence on event_facts; set role service_role");
  assert.equal(await register(6,current),true);
  assert.notEqual(await revision(6),current);
  assert.equal(await register(6,await revision(6)),false);
  assert.equal((await db.query("select count(*)::int as n from event_facts")).rows[0].n,2);
  await db.exec("reset role; set role anon");
  await assert.rejects(complete([id(1)]),/permission denied/);
  await assert.rejects(register(6,current),/permission denied/);
  console.log("PASS: current dates and status, manual locks, exact count, stale source revision, evidence rollback, public outbox, private RPCs");
} finally {
  await db.close();
}
