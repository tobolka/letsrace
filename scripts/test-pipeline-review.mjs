/** Isolated PostgreSQL regression; no production connection. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const current = '00000000-0000-0000-0000-000000000001';
const previous = '00000000-0000-0000-0000-000000000002';
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table watched_urls(id uuid primary key);
    create table events(id uuid primary key, name text, start_date date, updated_at timestamptz default now(), visibility text default 'public', status text default 'scheduled', merged_into_id uuid,
      age_categories text[],age_confidence text,audience text,disciplines text[],class_label text,uci_class text,website_url text);
    create table event_overrides(event_id uuid primary key,locked_fields text[]);
    create table event_facts(id uuid default gen_random_uuid(),event_id uuid,field text,value jsonb,previous jsonb,source_url text,method text,version text);
    grant usage on schema public to service_role;
    grant select,insert,update,delete on all tables in schema public to service_role;
  `);
  await db.exec(await readFile('supabase/migrations/20261025142103_pipeline_candidate_review.sql', 'utf8'));
  await db.exec(`insert into events(id,start_date,name,disciplines) values ('${current}','2027-05-01','Race 2027','{}'),('${previous}','2026-05-01','Race 2026','{mtb}');`);
  const state = async () => (await db.query('select jsonb_build_object(\'updated_at\',updated_at,\'start_date\',start_date) as value from events where id=$1',[current])).rows[0].value;
  const apply = async expected => (await db.query('select app_carry_previous_edition($1,$2,$3,$4) as applied', [current, previous, expected, { disciplines: ['mtb'] }])).rows[0].applied;
  const before = await state();
  await db.exec('set role service_role');
  assert.equal(await apply({ ...before, start_date:'2027-06-01' }), false);
  await db.exec(`insert into event_overrides values('${current}','{disciplines}');`);
  assert.equal(await apply(before), false);
  await db.exec('delete from event_overrides');
  assert.equal(await apply(before), true);
  assert.equal((await db.query('select * from event_facts')).rows.length, 1);
  assert.equal(await apply(before), false); // stale checkpoint
  // A failed audit insert rolls back the update too.
  await db.exec(`reset role; alter table event_facts add constraint reject_bad_method check(method <> 'previous_edition') not valid; update events set disciplines='{}' where id='${current}'; set role service_role;`);
  await assert.rejects(apply(await state()), /reject_bad_method/);
  assert.deepEqual((await db.query('select disciplines from events where id=$1',[current])).rows[0].disciplines, []);
  await db.exec(`insert into pipeline_candidates(candidate_key,evidence_hash,source_url,season,payload,evidence,reason,status) values('key','hash','https://club.test',2027,'{}','{}','review','rejected');`);
  await db.exec(`insert into pipeline_candidates(candidate_key,evidence_hash,source_url,season,payload,evidence,reason) values('key','hash','https://club.test',2027,'{}','{}','review') on conflict(candidate_key,evidence_hash) do nothing;`);
  assert.equal((await db.query('select status from pipeline_candidates')).rows[0].status, 'rejected');
  for (const role of ['anon','authenticated']) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query('select * from pipeline_candidates'), /permission denied/);
    await assert.rejects(apply(before), /permission denied/);
  }
  console.log('PASS: stale state, locks, audited transaction rollback, idempotent handoff, private access');
} finally { await db.close(); }
