/**
 * Send the results of a local pass to another database as a checked three-way merge.
 *
 *   node scripts/local-sync.cjs plan --out=DIR
 *       Compare the working copy with its untouched twin and write the change set.
 *       Moved dates, renames and status changes go to a separate file for review.
 *   node scripts/local-sync.cjs apply --changes=FILE --target=DB [--dry-run] [--batch=500]
 *       Merge it into a local database and write a journal for rollback.
 *   node scripts/local-sync.cjs rollback --journal=FILE --target=DB
 *       Undo an earlier apply, row by row, only where nobody changed the row since.
 *
 *   node scripts/local-sync.cjs send --changes=FILE --confirm=SHA256 [--dry-run]
 *       Send an approved plan to the real server. Reads its own server connection, refuses
 *       to run inside a local pass, and needs the plan's exact fingerprint as confirmation.
 *
 * Otherwise the target must be a database on this computer.
 */
const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { dirname, join, resolve } = require('node:path');

const BIN = process.env.LOCAL_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin';
const ENV = { ...process.env, LC_ALL: 'en_US.UTF-8', PGTZ: 'UTC' };
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

/**
 * Results only. Reading state (hashes, poll times, read receipts) stays on the Mac: it must
 * not tell the target that work is done when some of that work was held back. Candidates hold
 * publishing tokens and merge history must be created by the target, so neither travels here.
 */
const TABLES = ['locations', 'series', 'events', 'event_sources', 'event_series', 'event_categories', 'event_facts'];
/** Worked out by the target's own triggers, so a pass must not dictate them. */
const DERIVED = ['public_revision', 'search_text'];
const SERVER = Symbol('server');

/**
 * Changes that decide what a rider sees, and that a wrong identity match can produce.
 * They wait for review instead of going out with the rest, along with everything else
 * the pass wrote to that race, because all of it may belong to a different race.
 */
const REVIEW_COLUMNS = ['start_date', 'end_date', 'name', 'status', 'merged_into_id'];

function separateForReview(changes) {
  const isEvent = change => change.tab === 'public.events' && change.op === 'update';
  const reasons = new Map();
  for (const change of changes) {
    if (!isEvent(change)) continue;
    const decisive = REVIEW_COLUMNS.filter(column => column in change.after);
    if (decisive.length) reasons.set(change.pk.id, decisive);
  }
  const eventOf = change => change.owner ?? (change.tab === 'public.events' ? change.pk.id : (change.after ?? change.before)?.event_id);
  const send = [], held = [];
  for (const change of changes) {
    const reason = reasons.get(eventOf(change));
    if (reason) held.push({ ...change, heldBecause: reason });
    else send.push(change);
  }
  return { send, held };
}

/** The server connection exists only for the send step, never for a pass or a rehearsal. */
function serverEnvironment() {
  if (process.env.LETSRACE_LOCAL_PASS === '1') throw Error('Sending is not allowed from inside a local pass');
  const line = readFileSync('.env.local', 'utf8').split('\n').map(text => text.trim()).findLast(text => text.startsWith('SUPABASE_DB_URL='));
  if (!line) throw Error('SUPABASE_DB_URL is missing from .env.local');
  const url = new URL(line.slice('SUPABASE_DB_URL='.length).replace(/^["']|["']$/g, ''));
  return { ...ENV, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1) || 'postgres', PGSSLMODE: 'require', PGAPPNAME: 'letsrace-local-send' };
}

const psql = (database, sql) => execFileSync(`${BIN}/psql`, ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql],
  { encoding: 'utf8', maxBuffer: 2 ** 31 - 1, env: ENV });
const runFile = (database, file) => database === SERVER
  ? execFileSync(`${BIN}/psql`, ['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', maxBuffer: 2 ** 31 - 1, env: serverEnvironment() })
  : execFileSync(`${BIN}/psql`, ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', maxBuffer: 2 ** 31 - 1, env: ENV });

function plan(outDirectory, work = 'letsrace', base = 'letsrace_baseline') {
  mkdirSync(outDirectory, { recursive: true });
  const changes = [], summary = {};
  for (const table of TABLES) {
    const name = `public.${table}`;
    const { key, generated } = JSON.parse(psql(work, `select json_build_object(
      'key', (select json_agg(a.attname order by k.ord) from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum where i.indrelid = '${name}'::regclass and i.indisprimary),
      'generated', coalesce((select json_agg(attname) from pg_attribute where attrelid = '${name}'::regclass and attgenerated <> ''), '[]'))`));
    const skip = new Set([...DERIVED, ...generated]);
    const id = key.map(column => `t."${column}"::text`).join(` || chr(31) || `);
    const read = database => JSON.parse(psql(database, `select coalesce(json_object_agg(${id}, to_jsonb(t)), '{}') from ${name} t`));
    const before = read(base), after = read(work);
    const count = { insert: 0, update: 0, delete: 0, columns: {} };
    const pkOf = row => Object.fromEntries(key.map(column => [column, row[column]]));
    // Which race a row belongs to, kept even when its link did not change.
    const ownerOf = row => table === 'events' ? row.id : row.event_id ?? undefined;
    const trimmed = row => Object.fromEntries(Object.entries(row).filter(([column]) => !generated.includes(column)));
    for (const [rowId, row] of Object.entries(after)) {
      const old = before[rowId];
      if (!old) { changes.push({ tab: name, pk: pkOf(row), owner: ownerOf(row), op: 'insert', after: trimmed(row) }); count.insert++; continue; }
      const changed = Object.keys(row).filter(column => !skip.has(column) && JSON.stringify(row[column]) !== JSON.stringify(old[column]));
      if (!changed.length) continue;
      changes.push({ tab: name, pk: pkOf(row), owner: ownerOf(row), op: 'update', before: Object.fromEntries(changed.map(c => [c, old[c]])), after: Object.fromEntries(changed.map(c => [c, row[c]])) });
      count.update++;
      for (const column of changed) count.columns[column] = (count.columns[column] ?? 0) + 1;
    }
    for (const [rowId, row] of Object.entries(before)) if (!(rowId in after)) { changes.push({ tab: name, pk: pkOf(row), owner: ownerOf(row), op: 'delete', before: trimmed(row) }); count.delete++; }
    if (count.insert || count.update || count.delete) summary[table] = count;
  }
  const { send, held } = separateForReview(changes);
  const body = send.map(change => JSON.stringify(change)).join('\n');
  const file = join(outDirectory, 'changes.ndjson'), heldFile = join(outDirectory, 'held-for-review.ndjson');
  writeFileSync(file, body);
  writeFileSync(heldFile, held.map(change => JSON.stringify(change)).join('\n'));
  const heldRaces = new Set(held.filter(change => change.tab === 'public.events').map(change => change.pk.id)).size;
  writeFileSync(join(outDirectory, 'plan.json'), JSON.stringify({ at: new Date().toISOString(), rows: send.length, heldRows: held.length, heldRaces, sha256: createHash('sha256').update(body).digest('hex'), summary }, null, 2));
  return { file, heldFile, rows: send.length, heldRows: held.length, heldRaces, summary };
}

const CSV = `with (format csv, delimiter E'\\x02', quote E'\\x01')`;
const quote = path => `'${path.replaceAll("'", "''")}'`;

function apply({ file, target, dryRun = false, batch = 500, exact = false, journalOut, planSha, crashAfterBatch }) {
  if (target !== SERVER && (!/^letsrace_[a-z0-9_]+$/.test(target ?? '') || target === 'letsrace_baseline')) throw Error('The target must be a named local test database');
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const work = join(dirname(resolve(file)), `.apply-${randomUUID()}`);
  mkdirSync(work, { recursive: true });
  const totals = { applied: 0, unchanged: 0, conflict: 0, group_held: 0, failed: 0, pending: 0, skippedLockedColumns: 0 };
  const byTable = {}, problems = [], journal = [];
  const started = Date.now();
  const sha = planSha ?? createHash('sha256').update(lines.join('\n')).digest('hex');
  let transactions = 0, remaining = lines, batchNumber = 0;
  try {
    // A child held back by a later batch gets another round; a real problem stays reported.
    for (let round = 0; round < 3 && remaining.length; round++) {
      const held = [];
      // A race and its rows stay in one batch, so a package cannot be split across transactions.
      const groups = new Map();
      for (const line of remaining) {
        const change = JSON.parse(line), key = change.owner ?? `${change.tab}:${JSON.stringify(change.pk)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(line);
      }
      const batches = [[]];
      for (const rows of groups.values()) {
        if (batches.at(-1).length && batches.at(-1).length + rows.length > batch) batches.push([]);
        batches.at(-1).push(...rows);
      }
      for (const part of batches) {
        if (!part.length) continue;
        batchNumber++;
        const input = join(work, 'in.ndjson'), output = join(work, 'out.ndjson'), journalFile = join(work, 'journal.ndjson'), script = join(work, 'run.sql');
        writeFileSync(input, part.join('\n') + '\n');
        writeFileSync(script, `begin;
set local statement_timeout = '5min';
set local lock_timeout = '30s';
create temp table _settings on commit drop as select ${exact} as exact, array['public_revision','search_text']::text[] as excluded;
create temp table _raw (line jsonb) on commit drop;
\\copy _raw(line) from ${quote(input)} ${CSV}
create temp table _cs on commit drop as select row_number() over () as seq, line ->> 'tab' as tab, line -> 'pk' as pk, line ->> 'op' as op, line ->> 'owner' as owner,
  coalesce(line ->> 'owner', (line ->> 'tab') || (line ->> 'pk')) as grp,
  line -> 'before' as before, line -> 'after' as after, 'pending'::text as state, null::text as reason, null::text[] as columns, null::text[] as skipped_locked, line as raw from _raw;
create temp table _journal (seq bigint, tab text, pk jsonb, op text, before jsonb, after jsonb, owner text) on commit drop;
\\i ${quote(resolve(__dirname, 'local-sync.sql'))}
\\copy (select json_build_object('tab', tab, 'op', op, 'pk', pk, 'state', state, 'reason', reason, 'columns', columns, 'locked', skipped_locked, 'raw', case when state = 'pending' then raw end) from _cs order by seq) to ${quote(output)} ${CSV}
\\copy (select json_build_object('tab', tab, 'op', op, 'pk', pk, 'owner', owner, 'before', before, 'after', after) from _journal order by seq) to ${quote(journalFile)} ${CSV}
${dryRun || exact ? '' : `insert into public.pipeline_sync_batches (plan_sha, batch, summary, journal)
  select '${sha}', ${batchNumber}, (select jsonb_object_agg(state, n) from (select state, count(*) n from _cs group by 1) x),
    coalesce((select jsonb_agg(jsonb_build_object('tab', tab, 'op', op, 'pk', pk, 'owner', owner, 'before', before, 'after', after) order by seq) from _journal), '[]');`}
${dryRun ? 'rollback' : 'commit'};
`);
        runFile(target, script);
        transactions++;
        if (crashAfterBatch === batchNumber) throw Error('rehearsed crash after commit');
        for (const row of readFileSync(output, 'utf8').split('\n').filter(Boolean).map(JSON.parse)) {
          if (row.state === 'pending') { held.push(JSON.stringify(row.raw)); continue; }
          totals[row.state]++;
          const entry = byTable[row.tab] ??= { applied: 0, unchanged: 0, conflict: 0, failed: 0 };
          entry[row.state]++;
          if (row.locked?.length) totals.skippedLockedColumns += row.locked.length;
          if (row.state === 'conflict' || row.state === 'failed' || row.locked?.length) problems.push({ tab: row.tab, pk: row.pk, op: row.op, state: row.state, reason: row.reason, columns: row.columns, locked: row.locked });
        }
        journal.push(...readFileSync(journalFile, 'utf8').split('\n').filter(Boolean));
      }
      remaining = held;
    }
    totals.pending = remaining.length;
  } finally { rmSync(work, { recursive: true, force: true }); }
  // A convenience copy: the target's pipeline_sync_batches is the record that counts.
  if (journalOut) writeFileSync(journalOut, journal.slice().reverse().join('\n'));
  return { dryRun, seconds: Math.round((Date.now() - started) / 100) / 10, transactions, totals, byTable, problems };
}

if (require.main === module) {
  const step = process.argv[2];
  if (step === 'plan') {
    const { rows, heldRows, heldRaces, summary } = plan(arg('out') ?? 'tmp/local-sync');
    console.log(JSON.stringify({ rows, heldRows, heldRaces, summary }, null, 1));
  } else if (step === 'send') {
    const file = arg('changes'), sha = assertReviewed(file);
    if (arg('confirm') !== sha) throw Error(`Confirm with --confirm=${sha}`);
    const { problems, ...shown } = apply({ file, planSha: sha, target: SERVER, dryRun: process.argv.includes('--dry-run'), batch: Number(arg('batch') ?? 200), journalOut: process.argv.includes('--dry-run') ? undefined : `${file}.journal` });
    if (arg('problems')) writeFileSync(arg('problems'), JSON.stringify(problems, null, 2));
    console.log(JSON.stringify({ ...shown, problemSample: problems.slice(0, 5) }, null, 1));
  } else if (step === 'apply' || step === 'rollback') {
    const file = arg(step === 'apply' ? 'changes' : 'journal');
    const planSha = step === 'apply' ? assertReviewed(file) : undefined;
    const result = apply({ file, planSha, target: arg('target'), dryRun: process.argv.includes('--dry-run'), batch: Number(arg('batch') ?? 500), exact: step === 'rollback', journalOut: step === 'apply' && !process.argv.includes('--dry-run') ? `${file}.journal` : undefined });
    const { problems, ...shown } = result;
    if (arg('problems')) writeFileSync(arg('problems'), JSON.stringify(problems, null, 2));
    console.log(JSON.stringify({ ...shown, problemSample: problems.slice(0, 5) }, null, 1));
  } else {
    console.error('Usage: local-sync.cjs plan|apply|rollback|send');
    process.exitCode = 1;
  }
}

/** Rebuild the undo list from what the target itself recorded, even after a crash. */
function journalFromTarget(target, planSha, out) {
  const rows = JSON.parse(psql(target, `select coalesce(json_agg(b.journal order by b.id desc), '[]') from public.pipeline_sync_batches b where b.plan_sha = '${planSha}'`));
  writeFileSync(out, rows.flatMap(entries => entries.slice().reverse()).map(entry => JSON.stringify(entry)).join('\n'));
  return rows.length;
}

/** Only an approved plan can be sent: reviewed, and unchanged since the review. */
function assertReviewed(file) {
  const plan = JSON.parse(readFileSync(join(dirname(resolve(file)), 'plan.json'), 'utf8'));
  const sha = createHash('sha256').update(readFileSync(file, 'utf8')).digest('hex');
  if (!plan.reviewedAt) throw Error('This plan has not been through scripts/local-review-new.ts');
  if (plan.sha256 !== sha) throw Error('The change set no longer matches its reviewed plan');
  return sha;
}

module.exports = { plan, apply, assertReviewed, journalFromTarget, separateForReview, TABLES, psql };
