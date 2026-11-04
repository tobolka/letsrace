import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table locations(id uuid primary key, name text, municipality text, venue text, region text, region_code text,
      timezone text, country_code text, lat float8, lng float8, geog text, geocode_status text, updated_at timestamptz);
    create table events(id uuid primary key, slug text, name text, status text, visibility text, start_date date, end_date date,
      merged_into_id uuid, location_id uuid references locations on delete set null, updated_at timestamptz);
    create table event_overrides(event_id uuid references events, locked_fields text[]);
    create table event_facts(event_id uuid, field text, value jsonb, previous jsonb, quote text, method text, version text);
    grant all on all tables in schema public to service_role;
  `);
  for (const file of ["20261102084307_durable_publication_tasks.sql", "20261104080121_atomic_location_hygiene.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec("set role service_role");
  for (const n of [1,2,3]) await db.query("insert into locations(id,name,lat,lng,country_code,timezone) values($1,$2,49,15,'CZ','Europe/Prague')", [id(n), ["Brno","BRNO","Czechia"][n-1]]);
  for (const n of [4,5]) await db.query("insert into events(id,slug,name,status,visibility,start_date,location_id) values($1,$2,'Race','scheduled','public',current_date+1,$3)", [id(n),`race-${n}`,id(n-2)]);
  const snapshot = async n => (await db.query("select to_jsonb(l) as data from locations l where id=$1",[id(n)])).rows[0].data;
  const merge = async (keep, drop) => (await db.query("select pipeline_merge_duplicate_location($1,$2) as n",[keep,drop])).rows[0].n;
  const unpin = async expected => (await db.query("select pipeline_unpin_country_location($1) as ok",[expected])).rows[0].ok;
  const keep = await snapshot(1);
  const old = await snapshot(2);
  await db.query("update locations set venue='Specific venue' where id=$1",[id(2)]);
  assert.equal(await merge(keep,old),null, "changed snapshot");
  assert.equal(await merge(keep,await snapshot(2)),null, "specific venue protected");
  await db.query("update locations set venue=null where id=$1",[id(2)]);
  await db.query("insert into event_overrides values($1,array['location_id']),($2,array['location_id'])",[id(4),id(5)]);
  assert.equal(await merge(keep,await snapshot(2)),null, "locked race");
  const country = await snapshot(3);
  assert.equal(await unpin(country),false, "locked pin");
  await db.exec("delete from event_overrides");
  await db.query("update locations set venue='Specific venue' where id=$1",[id(3)]);
  assert.equal(await unpin(await snapshot(3)),false, "named venue pin");
  await db.query("update locations set venue=null where id=$1",[id(3)]);
  await db.exec(`reset role; create function block_delete() returns trigger language plpgsql as $$begin raise exception 'delete failed'; end$$;
    create trigger block_delete before delete on locations for each row execute function block_delete(); set role service_role;`);
  const tasks = async () => (await db.query("select key,payload from pipeline_tasks order by key")).rows;
  const before = await tasks();
  await assert.rejects(merge(keep,await snapshot(2)),/delete failed/);
  assert.deepEqual(await tasks(),before);
  assert.equal((await db.query("select location_id from events where id=$1",[id(4)])).rows[0].location_id,id(2));
  await db.exec("reset role; drop trigger block_delete on locations; set role service_role");
  assert.equal(await merge(keep,await snapshot(2)),1);
  assert.equal((await db.query("select location_id from events where id=$1",[id(4)])).rows[0].location_id,id(1));
  assert.equal(await merge(keep,old),null, "repeat");
  assert.equal(await unpin(country),true);
  assert.equal(await unpin(country),false, "stale pin");
  assert.equal((await db.query("select count(*)::int as n from event_facts")).rows[0].n,2);
  await db.exec("reset role; set role anon");
  await assert.rejects(merge(keep,old),/permission denied/);
  await assert.rejects(unpin(country),/permission denied/);
  console.log("PASS: locks, revision, venue, exact move, delete rollback with public tasks, history, repeat and private RPCs");
} finally {
  await db.close();
}
