// The first new kind of queue task, through the four ways two workers can cross each other.
//   node scripts/test-find-documents-tasks.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SITE = "https://club.test", LINK = "https://club.test/propozice-2027.pdf";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table locations(id uuid primary key, municipality text, country_code text);
    create table events(id uuid primary key, slug text, name text, status text, visibility text,
      start_date date, end_date date, merged_into_id uuid, registration_url text, website_url text, regulations_url text,
      location_id uuid references locations, updated_at timestamptz);
    create table event_overrides(event_id uuid references events, locked_fields text[]);
    create table event_facts(id uuid primary key default gen_random_uuid(), event_id uuid, field text, value jsonb, previous jsonb,
      source_url text, quote text, method text, version text, status text not null default 'active');
    grant all on all tables in schema public to service_role;
  `);
  for (const file of ["migrations/20261102084307_durable_publication_tasks.sql", "migrations/20261111153755_pipeline_proposals.sql", "migrations/20261111153805_find_documents_tasks.sql"]) {
    await db.exec(await readFile(`supabase/${file}`, "utf8"));
  }
  await db.query("insert into locations values ($1,'Kostelec','CZ')", [id(90)]);
  // 1 and 2 want regulations; 3 has them, 4 is locked, 5 is past, 6 is hidden, 7 has no site.
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await db.query("insert into events(id,slug,name,start_date,status,visibility,website_url,location_id) values($1,$2,$3,current_date+$4::int,'scheduled',$5,$6,$7)",
      [id(n), `race-${n}`, `Race ${n}`, n === 5 ? -3 : 20 + n, n === 6 ? "hidden" : "public", n === 7 ? null : `${SITE}/race-${n}`, id(90)]);
  }
  await db.query("update events set regulations_url='https://club.test/have.pdf' where id=$1", [id(3)]);
  await db.query("insert into event_overrides values ($1,array['regulations_url'])", [id(4)]);
  await db.exec("set role service_role");

  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await rows(sql, params))[0];
  const claim = async () => rows("select * from pipeline_claim_tasks('find_documents',array['http'],5)");
  const proposal = n => ({ event_id: id(n), field: "regulations_url", value: LINK, source_url: LINK, quote: "Propozice závodu 2027", reader: "site_documents", version: "2" });
  const finish = async (task, proposals, payload = task.payload) => (await one("select pipeline_finish_with_proposals($1,$2,$3,$4,$5) r",
    [task.key, task.token, JSON.stringify(payload), JSON.stringify({ found: proposals.length }), JSON.stringify(proposals)])).r;
  const count = async table => Number((await one(`select count(*) n from ${table}`)).n);
  const asOwner = async sql => { await db.exec("reset role"); await db.exec(sql); await db.exec("set role service_role"); };
  const expire = () => asOwner("update pipeline_tasks set lease_until=now()-interval '1 second' where status='running'");

  // Which races the work is for, and one task per site however often it is asked for.
  assert.deepEqual((await rows("select id from pipeline_find_documents_races()")).map(r => r.id), [id(1), id(2)]);
  assert.equal((await one("select pipeline_queue_find_documents($1) n", [[SITE, SITE, "not a site"]])).n, 1);
  assert.equal((await one("select pipeline_queue_find_documents($1) n", [[SITE]])).n, 0);
  assert.equal(await count("pipeline_tasks where kind='find_documents'"), 1);
  console.log("PASS: only races that want regulations; one task per site");

  // 1. Two workers want the same task: one gets it, the other gets nothing.
  const [a] = await claim();
  assert.equal(a.key, `find_documents:${SITE}`);
  assert.deepEqual(await claim(), []);
  console.log("PASS: two workers, one task: the second gets nothing");

  // 2. The worker dies after reading and before handing in. The lease runs out, another takes over.
  await expire();
  const [b] = await claim();
  assert.notEqual(b.token, a.token);
  assert.equal(Number((await one("select count(*) n from pipeline_task_attempts where outcome='lease_expired'")).n), 1);

  // 3. The first worker comes back late with its result. Nothing of it is taken.
  assert.deepEqual(await finish(a, [proposal(1), proposal(2)]), { accepted: false, reason: "stale_attempt" });
  assert.equal(await count("pipeline_proposals"), 0);
  assert.equal((await one("select status from pipeline_tasks where key=$1", [a.key])).status, "running");
  // The one that holds the task hands in, once.
  const done = await finish(b, [proposal(1), proposal(2)]);
  assert.equal(done.accepted, true); assert.equal(done.proposals.length, 2);
  assert.equal(await count("pipeline_proposals"), 2);
  assert.deepEqual(await finish(b, [proposal(1), proposal(2)]), { accepted: false, reason: "stale_attempt" });
  assert.equal(await count("pipeline_proposals"), 2);
  console.log("PASS: a worker back after its lease leaves nothing; the holder hands in exactly once");

  // A crash between handing in and deciding loses nothing: the proposals wait, and deciding twice writes once.
  for (const key of done.proposals) assert.equal((await one("select pipeline_apply_proposal($1) r", [key])).r.status, "applied");
  for (const key of done.proposals) assert.equal((await one("select pipeline_apply_proposal($1) r", [key])).r.repeated, true);
  assert.equal(await count("event_facts"), 2);
  assert.deepEqual(await rows("select id from pipeline_find_documents_races()"), []);
  console.log("PASS: proposals survive a crash before the decision, and are written once");

  // The site is read again only after its interval, and the same finding makes no second proposal.
  assert.equal((await one("select pipeline_queue_find_documents($1,3600) n", [[SITE]])).n, 0);
  await asOwner("update pipeline_tasks set finished_at=now()-interval '2 hours' where kind='find_documents'");
  assert.equal((await one("select pipeline_queue_find_documents($1,3600) n", [[SITE]])).n, 1);
  const [c] = await claim();
  assert.equal((await finish(c, [proposal(1)])).accepted, true);
  assert.equal(await count("pipeline_proposals"), 2);
  console.log("PASS: a site comes back after its interval; the same finding is still one proposal");

  // 4. The task's input changes while a worker is on it: its result is not taken, the task waits for a new attempt.
  await asOwner("update pipeline_tasks set finished_at=now()-interval '2 hours' where kind='find_documents'");
  await db.query("select pipeline_queue_find_documents($1,3600)", [[SITE]]);
  const [d] = await claim();
  await asOwner(`update pipeline_tasks set payload='{"site":"https://club.test","pages":2}' where key='${d.key}'`);
  const other = { ...proposal(2), value: "https://club.test/jiny.pdf", source_url: "https://club.test/jiny.pdf" };
  assert.deepEqual(await finish(d, [other]), { accepted: false, reason: "input_changed" });
  assert.equal(await count("pipeline_proposals"), 2);
  const after = await one("select status,token from pipeline_tasks where key=$1", [d.key]);
  assert.deepEqual([after.status, after.token], ["pending", null]);
  assert.equal(Number((await one("select count(*) n from pipeline_task_attempts where outcome='superseded'")).n), 1);
  console.log("PASS: input changed during the work: the result is dropped and the task is taken again");

  // A proposal out of shape takes the whole hand-in down with it; the task stays with its worker.
  const [e] = await claim();
  await assert.rejects(finish(e, [proposal(1), { ...proposal(2), source_url: "ftp://x" }]));
  assert.equal(await count("pipeline_proposals"), 2);
  assert.equal((await one("select status from pipeline_tasks where key=$1", [e.key])).status, "running");
  // Waiting after a failure uses the queue's own retry, with the reason kept on the attempt.
  assert.equal((await one("select pipeline_retry_task($1,$2,'failed:http_error',3600) ok", [e.key, e.token])).ok, true);
  assert.deepEqual(await claim(), []);
  assert.equal((await one("select error from pipeline_task_attempts where token=$1", [e.token])).error, "failed:http_error");
  console.log("PASS: one bad proposal refuses the whole hand-in; a failure waits with its reason recorded");
} finally { await db.close(); }
