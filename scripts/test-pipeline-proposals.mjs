// Proposals and the one function that decides them, in an isolated PostgreSQL.
//   npm install --prefix tmp/pipeline-db-test --no-package-lock --no-save @electric-sql/pglite
//   node scripts/test-pipeline-proposals.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LINK = "https://club.test/propozice-2027.pdf";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table locations(id uuid primary key);
    create table events(id uuid primary key, slug text, name text, status text, visibility text,
      start_date date, end_date date, merged_into_id uuid, registration_url text, website_url text, regulations_url text,
      location_id uuid, updated_at timestamptz);
    create table event_overrides(event_id uuid references events, locked_fields text[]);
    create table event_facts(id uuid primary key default gen_random_uuid(), event_id uuid, field text, value jsonb, previous jsonb,
      source_url text, quote text, method text, version text, status text not null default 'active');
    grant all on all tables in schema public to service_role;
  `);
  await db.exec(await readFile("supabase/migrations/20261102084307_durable_publication_tasks.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261111153755_pipeline_proposals.sql", "utf8"));
  await db.exec("set role service_role");
  // 1 plain, 2 locked, 3 merged, 4 hidden, 5 past, 6 already filled, 7 fails while writing history.
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await db.query("insert into events(id,slug,name,start_date,status,visibility) values($1,$2,'Race',current_date+$3::int,'scheduled','public')", [id(n), `race-${n}`, n === 5 ? -3 : 30]);
  }
  await db.query("insert into event_overrides values ($1,array['regulations_url'])", [id(2)]);
  await db.query("update events set merged_into_id=$2 where id=$1", [id(3), id(1)]);
  await db.query("update events set visibility='hidden' where id=$1", [id(4)]);
  await db.query("update events set regulations_url='https://club.test/older.pdf' where id=$1", [id(6)]);

  const submit = async (n, link = LINK, version = "1") => (await db.query(
    "select pipeline_submit_proposal($1,'regulations_url',to_jsonb($2::text),$3,$4,'site_documents',$5,'find_documents:club.test') as key",
    [id(n), link, link, "Propozice závodu 2027, start v 10:00", version])).rows[0].key;
  const apply = async key => (await db.query("select pipeline_apply_proposal($1) as r", [key])).rows[0].r;
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const facts = async n => Number((await one("select count(*) n from event_facts where event_id=$1", [id(n)])).n);

  // The same proposal twice is one row, and applying it twice writes once.
  const key = await submit(1);
  assert.equal(await submit(1), key);
  assert.equal(Number((await one("select count(*) n from pipeline_proposals")).n), 1);
  const revisionBefore = (await one("select public_revision::text r from events where id=$1", [id(1)])).r;
  const first = await apply(key);
  assert.equal(first.status, "applied");
  assert.equal((await one("select regulations_url from events where id=$1", [id(1)])).regulations_url, LINK);
  const fact = await one("select id,method,version,value,previous,source_url from event_facts where event_id=$1", [id(1)]);
  assert.deepEqual([fact.id, fact.method, fact.version, fact.value, fact.previous, fact.source_url], [first.fact, "site_documents", "1", LINK, null, LINK]);
  assert.deepEqual(await apply(key), { status: "applied", reason: null, repeated: true });
  assert.equal(await facts(1), 1);
  // The public refresh was queued by the same write, not by a second step that could be lost.
  const queued = await one("select t.payload->>'revision' task, e.public_revision::text race from events e join pipeline_tasks t on t.entity_id=e.id and t.kind='public_refresh' where e.id=$1 order by t.updated_at desc limit 1", [id(1)]);
  assert.ok(queued?.task && queued.task === queued.race && queued.task !== revisionBefore, "the public refresh was not queued for the new revision");
  // A different document for the now filled field does not overwrite it.
  assert.deepEqual(await apply(await submit(1, "https://club.test/other.pdf")), { status: "superseded", reason: "field_filled", fact: null });
  // A newer reader finding the same link is told so and writes nothing.
  assert.deepEqual(await apply(await submit(1, LINK, "2")), { status: "superseded", reason: "already_set", fact: null });
  assert.equal(await facts(1), 1);
  console.log("PASS: one proposal, one write, one history row; a filled field is never overwritten");

  // A manual lock holds the proposal, and lifting the lock lets the same proposal through.
  const locked = await submit(2);
  assert.deepEqual(await apply(locked), { status: "held", reason: "manual_lock", fact: null });
  assert.equal((await one("select regulations_url from events where id=$1", [id(2)])).regulations_url, null);
  await db.exec("reset role"); await db.query("update event_overrides set locked_fields='{}' where event_id=$1", [id(2)]); await db.exec("set role service_role");
  assert.equal((await apply(locked)).status, "applied");
  console.log("PASS: a manual lock holds; the held proposal is decided afresh once it is lifted");

  assert.deepEqual(await apply(await submit(3)), { status: "rejected", reason: "merged", fact: null });
  assert.deepEqual(await apply(await submit(4)), { status: "held", reason: "hidden", fact: null });
  assert.deepEqual(await apply(await submit(5)), { status: "rejected", reason: "past_race", fact: null });
  assert.deepEqual(await apply(await submit(6)), { status: "superseded", reason: "field_filled", fact: null });
  assert.deepEqual(await apply("no-such-key"), { status: "missing" });
  for (const n of [3, 4, 5, 6]) assert.equal(await facts(n), 0);
  assert.equal((await one("select regulations_url from events where id=$1", [id(6)])).regulations_url, "https://club.test/older.pdf");
  console.log("PASS: merged and past races are refused, a hidden one waits, nothing is written for any of them");

  // A value that is not a link, or evidence that is not a page, never becomes a proposal that writes.
  const bad = (await db.query("select pipeline_submit_proposal($1,'regulations_url',to_jsonb('not a link'::text),$2,$3,'site_documents','1') as key", [id(7), LINK, "Propozice závodu"])).rows[0].key;
  assert.deepEqual(await apply(bad), { status: "rejected", reason: "invalid_value", fact: null });
  await assert.rejects(db.query("select pipeline_submit_proposal($1,'regulations_url',to_jsonb($2::text),'ftp://x',$3,'site_documents','1')", [id(7), LINK, "Propozice závodu"]));
  await assert.rejects(db.query("select pipeline_submit_proposal($1,'regulations_url',to_jsonb($2::text),$2,'short','site_documents','1')", [id(7), LINK]));
  console.log("PASS: a value that is not a link and evidence without a page or words are refused");

  // If the history row cannot be written, the race is not changed and the proposal stays open.
  const doomed = await submit(7);
  await db.exec(`reset role; create function fail_evidence() returns trigger language plpgsql as $$begin raise exception 'evidence failure'; end$$;
    create trigger fail_evidence before insert on event_facts for each row execute function fail_evidence(); set role service_role;`);
  await assert.rejects(apply(doomed), /evidence failure/);
  assert.equal((await one("select regulations_url from events where id=$1", [id(7)])).regulations_url, null);
  assert.equal((await one("select status from pipeline_proposals where key=$1", [doomed])).status, "proposed");
  await db.exec("reset role; drop trigger fail_evidence on event_facts; set role service_role;");
  assert.equal((await apply(doomed)).status, "applied");
  console.log("PASS: a failed history write changes nothing, and the proposal can be applied afterwards");

  // Only the service role may hand in or decide.
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query("select pipeline_apply_proposal($1)", [key]), /permission denied/);
  await assert.rejects(db.query("select * from pipeline_proposals"), /permission denied/);
  console.log("PASS: signed-in visitors can neither read proposals nor decide them");
} finally { await db.close(); }
