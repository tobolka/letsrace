/** Isolated PostgreSQL test; does not connect to Supabase.
 * npm install --prefix tmp/pipeline-db-test --no-package-lock --no-save @electric-sql/pglite
 * node scripts/test-merge-recovery.mjs
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const keep = "00000000-0000-0000-0000-000000000001";
const drop = "00000000-0000-0000-0000-000000000002";
const snapshot = async () => (await db.query("select app_merge_snapshot($1,$2) as state", [keep, drop])).rows[0].state;
const check = async (sql, params = []) => (await db.query(sql, params)).rows;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table ingest_runs(id uuid primary key);
    create table locations(id uuid primary key, lat float);
    create table series(id uuid primary key);
    create table events(id uuid primary key, name text not null, start_date date, end_date date,
      fingerprint text unique, merged_into_id uuid references events(id), series_id uuid references series(id),
      location_id uuid references locations(id), age_categories text[], age_confidence text, audience text,
      disciplines text[], formats text[], level text, uci_class text, class_label text, description text,
      registration_opens_at date, registration_closes_at date, website_url text, registration_url text,
      regulations_url text, results_url text, visibility text default 'public', status text default 'scheduled',
      updated_at timestamptz default now(), search_text text generated always as (lower(name)) stored);
    create table event_sources(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),external_id text);
    create table event_categories(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),name text,
      age_min int,age_max int,distance_km float,elevation_m float,gender text,audience text);
    create table event_favorites(user_id uuid,event_id uuid references events(id),created_at timestamptz default now(),fee_amount int,primary key(user_id,event_id));
    create table event_attendance(user_id uuid,event_id uuid references events(id),member_id uuid,status text,registered bool,paid bool,notes text,
      created_at timestamptz default now(),updated_at timestamptz default now(),primary key(user_id,event_id,member_id));
    create table event_facts(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),value jsonb);
    create table event_overrides(event_id uuid primary key references events(id),locked_fields text[]);
    create table duplicate_reviews(left_id uuid,right_id uuid);
  `);
  const memberships = await readFile("supabase/migrations/20260917082837_event_series_membership.sql", "utf8");
  await db.exec(memberships.slice(0, memberships.indexOf("-- Merges must carry")));
  await db.exec(await readFile("supabase/migrations/20260930210327_merge_keeps_best_facts.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261023184216_audited_event_merges.sql", "utf8"));
  await db.exec("grant usage on schema public to service_role; grant select,insert,update,delete on all tables in schema public to service_role;");
  await db.exec(`
    insert into series values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
    insert into events(id,name,fingerprint,series_id,age_categories,age_confidence,disciplines)
      values('${keep}','Perlcross','keep','10000000-0000-0000-0000-000000000001','{}',null,'{}'),
      ('${drop}','Perlcross mirror','drop','10000000-0000-0000-0000-000000000002','{U13}','explicit','{cx}');
    insert into events(id,name,fingerprint,merged_into_id) values ('00000000-0000-0000-0000-000000000003','Old redirect','redirect','${drop}');
    insert into event_sources(event_id,external_id) values ('${drop}','race-123');
    insert into event_categories(event_id,name) values ('${drop}','U13');
    insert into event_facts(event_id,value) values ('${drop}','{"source":"official"}');
    insert into event_favorites values ('20000000-0000-0000-0000-000000000001','${keep}',now(),null),('20000000-0000-0000-0000-000000000001','${drop}',now(),500);
    insert into event_attendance values
      ('20000000-0000-0000-0000-000000000001','${keep}','30000000-0000-0000-0000-000000000001','maybe',false,false,'left',now(),now()),
      ('20000000-0000-0000-0000-000000000001','${drop}','30000000-0000-0000-0000-000000000001','going',true,true,'right',now(),now());
    set role service_role;
  `);
  const before = await snapshot();
  await check("select app_merge_events($1,$2)", [keep, drop]);
  assert.equal((await check("select count(*)::int as n from event_series where event_id=$1", [keep]))[0].n, 2);
  assert.equal((await check("select event_id from event_facts"))[0].event_id, keep);
  const history = (await check("select * from pipeline_merge_history"))[0];
  const after = await snapshot();
  assert.deepEqual(history.before_state, before);
  assert.deepEqual(history.after_state, after);
  await check("select app_merge_events($1,$2)", [keep, drop]);
  assert.equal((await check("select count(*)::int as n from pipeline_merge_history"))[0].n, 1);
  await check("update events set name='Later manual correction' where id=$1", [keep]);
  await assert.rejects(check("select app_restore_event_merge($1)", [history.id]), /state changed/);
  assert.equal((await check("select name from events where id=$1", [keep]))[0].name, "Later manual correction");
  await check("update events set name='Perlcross' where id=$1", [keep]);
  await check("select app_restore_event_merge($1)", [history.id]);
  assert.deepEqual(await snapshot(), before, "restores events, redirects, evidence, memberships and personal plans exactly");
  await assert.rejects(check("select app_restore_event_merge($1)", [history.id]), /already restored/);
  await db.exec("reset role; set role anon;");
  await assert.rejects(check("select * from pipeline_merge_history"), /permission denied/);
  await assert.rejects(check("select * from pipeline_extraction_cache"), /permission denied/);
  await assert.rejects(check("select app_restore_event_merge($1)", [history.id]), /permission denied/);
  await db.exec(`reset role;
    create function fail_merge_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$;
    create trigger fail_audit before insert on pipeline_merge_history for each row execute function fail_merge_audit();
    set role service_role;`);
  await assert.rejects(check("select app_merge_events($1,$2)", [keep, drop]), /audit unavailable/);
  assert.deepEqual(await snapshot(), before, "audit failure rolls back the entire merge");
  await check("insert into duplicate_reviews values ($1,$2)", [keep, drop]);
  await assert.rejects(check("select app_merge_events($1,$2)", [keep, drop]), /reviewed as separate/);
  console.log("PASS: migration, service-role merge, evidence/memberships, personal-plan recovery, stale-restore guard, idempotency, public permissions, atomic rollback");
} finally { await db.close(); }
