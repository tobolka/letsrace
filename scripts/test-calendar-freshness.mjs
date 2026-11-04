import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const url = "https://calendar.test/";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table watched_urls(id uuid primary key, status text, url text);
    create table pipeline_tasks(key text primary key, entity_id uuid, kind text, status text, token uuid, lease_until timestamptz);
    create table events(id uuid primary key, start_date date, status text, visibility text, merged_into_id uuid, last_seen_at timestamptz, updated_at timestamptz);
    create table event_sources(event_id uuid references events, watched_url_id uuid, external_id text);
    create table event_overrides(event_id uuid references events, locked_fields text[]);
    create table event_facts(event_id uuid, field text, value jsonb, previous jsonb, source_url text, method text, version text);
    grant all on all tables in schema public to service_role;
    insert into watched_urls values ('${id(100)}','active','${url}');
    insert into pipeline_tasks values ('source','${id(100)}','source_read','running','${id(101)}',now()+interval '1 hour');
  `);
  await db.exec(await readFile("supabase/migrations/20261104071531_fence_calendar_freshness.sql", "utf8"));
  for (let n = 1; n <= 9; n++) {
    await db.query("insert into events(id,start_date,status,visibility) values ($1,current_date+$2::integer,'scheduled','public')", [id(n), n]);
    await db.query("insert into event_sources values ($1,$2,$3)", [id(n), id(100), String(n)]);
  }
  await db.query("insert into event_sources values ($1,null,'manual'),($2,$3,'alias')", [id(7), id(6), id(100)]);
  await db.query("insert into event_overrides values ($1,array['status'])", [id(8)]);
  const run = async (ids, count = ids?.length, token = id(101)) => (await db.query(
    "select pipeline_calendar_freshness($1,$2,$3,$4,$5,$6,current_date,current_date+8) as count",
    [id(100), "source", token, url, ids ?? null, count ?? null],
  )).rows[0].count;
  await db.exec("set role service_role");
  await assert.rejects(run(["1","2","3","4","5"], 5, id(102)), /source lease lost/);
  assert.equal(await run(["1","2"], 2), 0, "tiny read");
  assert.equal(await run(["new","ids","here"]), 0, "rewritten IDs");
  assert.equal(await run(["1","2","3"], 3), 0, "low overlap");
  assert.equal(await run(), 9, "one bulk freshness update");
  assert.equal(await run(), 0, "recent observations are not rewritten");
  assert.equal(await run(["1","2","3","4","alias"]), 1);
  const hidden = (await db.query("select id from events where status='hidden'")).rows;
  assert.deepEqual(hidden, [{ id: id(5) }], "alias, alternative source, lock and date window protect other races");
  assert.deepEqual((await db.query("select field,previous from event_facts order by field")).rows, [
    { field: "status", previous: "scheduled" },
    { field: "visibility", previous: "public" },
  ]);
  await db.exec("reset role; update watched_urls set status='paused'; set role service_role");
  await assert.rejects(run(), /source changed/);
  await db.exec("reset role; set role anon");
  await assert.rejects(run(), /permission denied/);
  console.log("PASS: lease, source pause, bulk freshness, overlap, aliases, alternative evidence, locks, date window, audit and restricted access");
} finally {
  await db.close();
}
