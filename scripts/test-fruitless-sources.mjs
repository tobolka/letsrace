import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const good = { complete: true, extracted: 0, failed: 0, deferred: false, pendingWrites: 0, deferredWrites: 0 };
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table watched_urls(id uuid primary key, url text, status text, added_by text, parent_id uuid, notes text, last_extract_status text, created_at timestamptz default now(), updated_at timestamptz);
    create table event_sources(event_id uuid, watched_url_id uuid, source_url text);
    create table events(website_url text, registration_url text, regulations_url text);
    create table pipeline_candidates(watched_url_id uuid, status text);
    create table pipeline_tasks(key text, status text);
    create table ingest_runs(id bigint generated always as identity primary key, watched_url_id uuid, started_at timestamptz default clock_timestamp(), finished_at timestamptz default now(), ok boolean, http_status integer, events_upserted integer default 0, links_discovered integer default 0, metrics jsonb);
    grant all on all tables in schema public to service_role;`);
  await db.exec(await readFile('supabase/migrations/20261105070200_require_complete_reads_before_auto_pause.sql', 'utf8'));
  const source = async (n, changes = {}, reads = 3) => {
    const row = { id: id(n), url: `https://club.test/page-${n}`, status: 'active', added_by: 'auto-same-domain', last_extract_status: 'ok', ...changes };
    await db.query('insert into watched_urls(id,url,status,added_by,last_extract_status) values($1,$2,$3,$4,$5)', Object.values(row));
    for (let i = 0; i < reads; i++) await db.query('insert into ingest_runs(watched_url_id,ok,http_status,metrics) values($1,true,200,$2)', [id(n), good]);
    return row;
  };
  await source(1, { last_extract_status: 'needs_review' }); // A complete empty read has this status in watchOne.
  await source(2, {}, 2); // Not enough observations.
  for (const [n, status] of [[3,'error'],[4,'off_season'],[6,'dead']]) await source(n, { last_extract_status: status });
  await source(5, { last_extract_status: 'needs_review' });
  await db.query('update ingest_runs set metrics=$1 where watched_url_id=$2', [{ ...good, complete: false },id(5)]);
  await source(7, { added_by: 'manual' });
  await source(8, { url: 'https://club.test/' });
  await source(9, { url: `https://club.test/${new Date().getUTCFullYear() + 1}/race` });
  const variants = [
    { ok: false }, { http_status: 503 }, { finished_at: null },
    { metrics: { ...good, complete: false } }, { metrics: { ...good, extracted: 1 } },
    { metrics: { ...good, deferred: true } }, { metrics: { ...good, pendingWrites: 1 } },
    { metrics: { ...good, failed: 1 } }, { metrics: { ...good, deferredWrites: 1 } },
    { metrics: {} }, { links_discovered: 1 }, { events_upserted: 1 }, { metrics: { ...good, issues: ['unsupported_or_empty_source'] } },
  ];
  for (const [i, patch] of variants.entries()) {
    const n = 10 + i;
    await source(n);
    const fields = Object.keys(patch);
    await db.query(`insert into ingest_runs(watched_url_id,ok,http_status,metrics,${fields.filter(k => !['ok','http_status','metrics'].includes(k)).join(',') || 'events_upserted'}) values ($1,$2,$3,$4,$5)`,
      [id(n), patch.ok ?? true, patch.http_status ?? 200, patch.metrics ?? good,
        'finished_at' in patch ? null : patch.links_discovered ?? patch.events_upserted ?? 0]);
  }
  for (const [n,status] of [[30,'pending'],[31,'waiting'],[32,'conflict'],[33,'publishing']]) {
    await source(n); await db.query('insert into pipeline_candidates values($1,$2)', [id(n),status]);
  }
  await source(34); await db.query('insert into pipeline_tasks values($1,\'running\')', [`source:${id(34)}`]);
  const linked = await source(35); await db.query('insert into event_sources values($1,$2,$3)', [id(100),id(35),linked.url]);
  const website = await source(36); await db.query('insert into events(website_url) values($1)', [website.url]);
  await source(37); await db.query('insert into watched_urls(id,parent_id,status) values($1,$2,\'active\')', [id(137),id(37)]);
  await source(38); await db.query('insert into watched_urls(id,parent_id,status) values($1,$2,\'paused\')', [id(138),id(38)]);
  await db.query('insert into event_sources values($1,$2,null)', [id(100),id(138)]);
  await db.exec('set role service_role');
  assert.equal((await db.query('select pipeline_pause_fruitless_sources(1,200) as n')).rows[0].n, 1, 'even a caller requesting one read must have three complete reads');
  assert.deepEqual((await db.query("select id,notes from watched_urls where status='paused' and added_by='auto-same-domain'")).rows, [{ id: id(1), notes: '[auto-bez-zavodu]' }]);
  assert.equal((await db.query('select pipeline_pause_fruitless_sources() as n')).rows[0].n, 0, 'repeat is idempotent');
  for (const role of ['anon','authenticated']) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query('select pipeline_pause_fruitless_sources()'), /permission denied/);
  }
  console.log('PASS: complete consecutive reads, failures, unknown metrics, pending work, season announcements, manual sources, children, existing events, idempotence and private access');
} finally { await db.close(); }
