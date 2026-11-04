import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const event = "00000000-0000-4000-8000-000000000101";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table locations(id uuid primary key default gen_random_uuid(),name text,municipality text,venue text,country_code text,
      timezone text,lat float8,lng float8,geocode_query text,geocode_status text,geog text);
    create function set_location_geog(loc_id uuid,lng float8,lat float8) returns void language sql
      as $$update locations set geog=concat(lng,',',lat) where id=loc_id$$;
    create table events(id uuid primary key,slug text,name text,status text,visibility text,start_date date,end_date date,
      merged_into_id uuid,location_id uuid references locations,age_categories text[],age_confidence text,audience text,
      website_url text,updated_at timestamptz);
    create table event_overrides(event_id uuid references events,locked_fields text[]);
    create table event_facts(event_id uuid,field text,value jsonb,previous jsonb,source_url text,quote text,method text,version text);
    grant all on all tables in schema public to service_role;
  `);
  for (const file of ["20261102084307_durable_publication_tasks.sql","20261104083208_atomic_catalog_detail_writes.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  }
  await db.exec(`set role service_role;
    insert into events(id,slug,name,status,visibility,start_date) values
      ('${event}','race','Race','scheduled','public',current_date+2);`);
  const website = "https://organiser.test/";
  const source = "https://www.cyclingaustria.at/index.php?view=event&id=123";
  const place = { town: "Graz", lat: 47.07, lng: 15.44 };
  const revision = async () => (await db.query("select public_revision from events")).rows[0].public_revision;
  const apply = async (rev, method, patch, newPlace = null) => (await db.query(
    "select pipeline_apply_catalogue_detail($1,$2,$3,$4,$5,$6,$7) as changed",
    [event,rev,method,source,patch,newPlace,"Fixture evidence"],
  )).rows[0].changed;
  const first = await revision();
  await db.exec("update events set name='New name'");
  const current = await revision();
  assert.deepEqual(await apply(first,"cycling_austria_detail",{website_url:website},place),[]);
  await db.query("insert into event_overrides values($1,array['website_url','location_id'])",[event]);
  assert.deepEqual(await apply(current,"cycling_austria_detail",{website_url:website},place),[]);
  await db.exec("delete from event_overrides");
  assert.deepEqual(await apply(current,"fci_website",{website_url:website}),["website_url"]);
  const linked = await revision();
  assert.deepEqual(await apply(linked,"rideandrest_website",{website_url:"https://backup.test/"}),[]);

  await db.exec(`reset role; create function fail_evidence() returns trigger language plpgsql as $$begin raise exception 'evidence unavailable'; end$$;
    create trigger fail_evidence before insert on event_facts for each row execute function fail_evidence(); set role service_role;`);
  const tasks = async () => (await db.query("select key,payload from pipeline_tasks order by key")).rows;
  const before = await tasks();
  await assert.rejects(apply(linked,"cycling_austria_detail",{},place),/evidence unavailable/);
  assert.equal(await revision(),linked);
  assert.deepEqual(await tasks(),before);
  assert.equal((await db.query("select count(*)::int as n from locations")).rows[0].n,0);
  await db.exec("reset role; drop trigger fail_evidence on event_facts; set role service_role");
  assert.deepEqual(await apply(linked,"cycling_austria_detail",{age_categories:["u15"],age_confidence:"explicit",audience:"youth"},place),
    ["age_categories","age_confidence","audience","location_id"]);
  assert.equal((await db.query("select geog from locations join events on location_id=locations.id")).rows[0].geog,"15.44,47.07");
  assert.equal((await db.query("select count(*)::int as n from event_facts")).rows[0].n,5);
  await db.exec("update locations set venue='Named venue'");
  assert.deepEqual(await apply(await revision(),"cycling_austria_detail",{}, {town:"Vienna"}),[]);
  await db.exec("reset role; set role anon");
  await assert.rejects(apply(linked,"fci_website",{website_url:website}),/permission denied/);
  console.log("PASS: revision, manual locks, website precedence, geog, no orphan location, evidence and public outbox rollback, private RPC");
} finally {
  await db.close();
}
