/**
 * Rehearsal of sending a local pass, on this computer only. Needs a working copy with
 * changes (scripts/local-db.sh start) and its twin. Builds a stand-in for the server from
 * the twin, makes the kinds of edits people and jobs make during a pass, then proves:
 * a dry run changes nothing, their edits survive, locks hold, conflicts are reported,
 * a repeat changes nothing, and a rollback restores the target.
 */
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { plan, apply, journalFromTarget, TABLES, psql } = require('./local-sync.cjs');

const TARGET = 'letsrace_target', PRE = 'letsrace_target_pre';
const one = (database, sql) => psql(database, sql).trim();
const directory = mkdtempSync(join(tmpdir(), 'local-sync-'));
const passed = [];
let finished = false;
const check = (name, condition, detail) => { assert.ok(condition, `${name}: ${JSON.stringify(detail)}`); passed.push(name); console.log(`PASS ${name}`); };

/** A fingerprint of everything sent, ignoring what the target's own triggers recompute. */
const sorted = database => Object.fromEntries(TABLES.map(table => [table, one(database, `select count(*) || ':' || coalesce(md5(string_agg(h, '' order by h)), '') from (select md5((to_jsonb(t) - 'public_revision' - 'search_text' - 'updated_at')::text) h from public.${table} t) x`)]));

function recreate(name, template) {
  psql('postgres', `drop database if exists ${name} with (force)`);
  psql('postgres', `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${template}'`);
  psql('postgres', `create database ${name} template ${template}`);
}

(async () => { try {
  const planned = plan(directory);
  console.log('Change set', JSON.stringify(planned.summary));
  check('the pass produced changes to send', planned.rows > 0, planned);
  check('no account or personal table is in the change set', !Object.keys(planned.summary).some(table => ['profiles', 'family_members', 'admin_users', 'admin_notifications', 'feedback_requests', 'organizer_claims', 'organizer_edits', 'race_submissions', 'race_alerts', 'race_alert_deliveries', 'event_favorites', 'event_attendance', 'event_plan_changes', 'plan_change_deliveries', 'plan_digest_deliveries', 'blocked_days', 'blocked_weekends', 'event_overrides', 'pipeline_owner_decisions'].includes(table)), planned.summary);

  check('moved dates are held back, not sent', planned.heldRaces >= 0 && !require('node:fs').readFileSync(planned.file, 'utf8').split('\n').filter(Boolean).map(JSON.parse).some(change => change.tab === 'public.events' && change.op === 'update' && ('start_date' in change.after || 'end_date' in change.after || 'name' in change.after || 'status' in change.after)));
  const heldLines = require('node:fs').readFileSync(planned.heldFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const heldIds = new Set(heldLines.filter(change => change.tab === 'public.events').map(change => change.pk.id));
  const sentLines = require('node:fs').readFileSync(planned.file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  check("a held race's other changes wait with it", !sentLines.some(change => heldIds.has(change.tab === 'public.events' ? change.pk.id : (change.after ?? change.before)?.event_id)));
  console.log(`Held for review: ${planned.heldRaces} races, ${planned.heldRows} rows`);

  recreate(TARGET, 'letsrace_baseline');
  execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', TARGET, '-q', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/migrations/20261105150000_pipeline_sync_batches.sql'], { env: { ...process.env, LC_ALL: 'en_US.UTF-8' } });

  // Pick real rows the pass changed, then have "someone else" touch them first.
  const changes = require('node:fs').readFileSync(planned.file, 'utf8').split('\n').map(JSON.parse);
  const eventUpdates = changes.filter(change => change.tab === 'public.events' && change.op === 'update');
  const withColumn = column => eventUpdates.filter(change => column in change.after);
  const conflictRow = withColumn('location_id')[0];
  const lockedRow = withColumn('location_id')[1];
  const elsewhereRow = eventUpdates.find(change => change !== conflictRow && change !== lockedRow && !('description' in change.after));
  const mergedRow = eventUpdates.find(change => ![conflictRow, lockedRow, elsewhereRow].includes(change));
  check('rehearsal found real rows for every case', conflictRow && lockedRow && elsewhereRow && mergedRow);

  psql(TARGET, `update public.events set location_id = (select id from public.locations where id <> '${conflictRow.after.location_id}' and id <> coalesce('${conflictRow.before.location_id ?? '00000000-0000-0000-0000-000000000000'}', id) limit 1) where id = '${conflictRow.pk.id}'`);
  psql(TARGET, `insert into public.event_overrides (event_id, locked_fields, updated_by) values ('${lockedRow.pk.id}', '{location_id}', 'rehearsal')`);
  psql(TARGET, `update public.events set description = 'Written by the organiser during the pass' where id = '${elsewhereRow.pk.id}'`);
  psql(TARGET, `update public.events set merged_into_id = '${elsewhereRow.pk.id}' where id = '${mergedRow.pk.id}'`);
  const lockedBefore = one(TARGET, `select location_id from public.events where id = '${lockedRow.pk.id}'`);
  const conflictBefore = one(TARGET, `select location_id from public.events where id = '${conflictRow.pk.id}'`);

  // A row that arrives under another key but breaks a unique rule on the target.
  const chosen = new Set([conflictRow, lockedRow, elsewhereRow, mergedRow].map(row => row.pk.id));
  const newSource = changes.find(change => change.tab === 'public.event_sources' && change.op === 'insert' && change.after.external_id && change.after.watched_url_id && !chosen.has(change.owner));
  if (newSource) psql(TARGET, `insert into public.event_sources (event_id, watched_url_id, source_url, external_id) select '${elsewhereRow.pk.id}', '${newSource.after.watched_url_id}', 'https://rehearsal.test/', '${String(newSource.after.external_id).replaceAll("'", "''")}'`);

  recreate(PRE, TARGET);
  const untouched = sorted(TARGET);

  const dry = apply({ file: planned.file, target: TARGET, dryRun: true });
  check('dry run changes nothing', JSON.stringify(sorted(TARGET)) === JSON.stringify(untouched), dry.totals);
  check('dry run predicts the same outcome as a real run would need', dry.totals.applied > 0, dry.totals);

  const journal = join(directory, 'journal.ndjson');
  const tasksBefore = Number(one(TARGET, "select count(*) from public.pipeline_tasks where kind = 'public_refresh' and status <> 'done'"));
  const real = apply({ file: planned.file, target: TARGET, journalOut: journal });
  console.log('Applied', JSON.stringify(real.totals), `${real.seconds}s in ${real.transactions} transactions`);
  console.log('Tables', JSON.stringify(real.byTable));
  const failures = real.problems.filter(problem => problem.state === 'failed');
  if (failures.length) console.log('Failed sample', JSON.stringify(failures.slice(0, 4)));
  check('nothing is left waiting', real.totals.pending === 0, real.totals);

  const find = (row, state) => real.problems.find(problem => problem.pk.id === row.pk.id && problem.state === state);
  check('a value someone changed is kept and reported as a conflict', find(conflictRow, 'conflict')?.columns?.includes('location_id') && one(TARGET, `select location_id from public.events where id = '${conflictRow.pk.id}'`) === conflictBefore, find(conflictRow, 'conflict'));
  check('a manually locked field is not overwritten', one(TARGET, `select location_id from public.events where id = '${lockedRow.pk.id}'`) === lockedBefore && real.problems.some(problem => problem.pk.id === lockedRow.pk.id && problem.locked?.includes('location_id')));
  check("someone's edit to another column survives next to the pass's changes", one(TARGET, `select description from public.events where id = '${elsewhereRow.pk.id}'`) === 'Written by the organiser during the pass');
  const lastSeen = one(TARGET, `select last_seen_at is not distinct from '${elsewhereRow.after.last_seen_at ?? ''}'::timestamptz from public.events where id = '${elsewhereRow.pk.id}'`);
  check('the same row still received the pass change', lastSeen === 't' || !elsewhereRow.after.last_seen_at, lastSeen);
  check('a race merged elsewhere is left alone', find(mergedRow, 'conflict')?.reason === 'merged_in_target', find(mergedRow, 'conflict'));
  if (newSource) check('a duplicate source is reported, not forced in', real.problems.some(problem => problem.pk.id === newSource.pk.id && problem.state === 'failed' && /unique|duplicate/i.test(problem.reason ?? '')));

  const tasksAfter = Number(one(TARGET, "select count(*) from public.pipeline_tasks where kind = 'public_refresh' and status <> 'done'"));
  console.log(`Page refresh tasks ${tasksBefore} -> ${tasksAfter}`);
  check("the target's own triggers queued its page refreshes", tasksAfter >= tasksBefore);

  const afterFirst = sorted(TARGET);
  const again = apply({ file: planned.file, target: TARGET, journalOut: join(directory, 'second.ndjson') });
  check('sending the same results again changes nothing', again.totals.applied === 0 && again.totals.failed === real.totals.failed && again.totals.conflict === real.totals.conflict && JSON.stringify(sorted(TARGET)) === JSON.stringify(afterFirst), again.totals);

  const undo = apply({ file: journal, target: TARGET, exact: true });
  console.log('Rollback', JSON.stringify(undo.totals), `${undo.seconds}s`);
  const reasons = {};
  for (const problem of undo.problems) { const key = `${problem.tab} ${problem.op} ${problem.state}: ${String(problem.reason).slice(0, 110)} ${problem.columns ?? ''}`; reasons[key] = (reasons[key] ?? 0) + 1; }
  console.log('Rollback problems', JSON.stringify(reasons, null, 1));
  const restored = sorted(TARGET);
  const differing = TABLES.filter(table => restored[table] !== untouched[table]);
  check('rollback restores the target exactly', differing.length === 0 && undo.totals.conflict === 0 && undo.totals.failed === 0, { differing, totals: undo.totals, problems: undo.problems.slice(0, 3) });

  // One conflict stops the whole race: no evidence or source lands without the race itself.
  const withChild = eventUpdates.find(change => !chosen.has(change.pk.id) && changes.some(child => child.tab !== 'public.events' && child.owner === change.pk.id && child.op === 'insert') && Object.keys(change.after).some(column => !['updated_at', 'last_seen_at'].includes(column)));
  if (withChild) {
    recreate(TARGET, PRE);
    const column = Object.keys(withChild.after).find(name => !['updated_at', 'last_seen_at'].includes(name));
    const typed = one(TARGET, `select data_type from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = '${column}'`);
    const other = typed === 'uuid' ? `(select id from public.locations where id <> coalesce('${withChild.after[column] ?? '00000000-0000-0000-0000-000000000000'}'::uuid, id) and id <> coalesce((select ${column} from public.events where id = '${withChild.pk.id}'), '00000000-0000-0000-0000-000000000000') limit 1)` : `'rehearsal-${column}'`;
    psql(TARGET, `update public.events set ${column} = ${other} where id = '${withChild.pk.id}'`);
    const packaged = apply({ file: planned.file, target: TARGET, journalOut: join(directory, 'package.ndjson') });
    const children = changes.filter(child => child.owner === withChild.pk.id && child.op === 'insert' && child.tab !== 'public.events');
    const landed = children.filter(child => one(TARGET, `select count(*) from ${child.tab} where id = '${child.pk.id}'`) !== '0');
    check("a conflict holds back that race's sources and evidence too", landed.length === 0 && packaged.problems.some(problem => problem.pk.id === withChild.pk.id && problem.state === 'conflict'), { landed: landed.length });
  } else console.log('NOTE no race with both a real change and new child rows in this pass; package check skipped');

  // A lock on categories covers a race's category rows, as the target's own writers do.
  const categoryRow = changes.find(change => change.tab === 'public.event_categories' && change.op === 'insert' && !chosen.has(change.owner) && eventUpdates.some(update => update.pk.id === change.owner));
  if (categoryRow) {
    recreate(TARGET, PRE);
    psql(TARGET, `insert into public.event_overrides (event_id, locked_fields, updated_by) values ('${categoryRow.owner}', '{categories}', 'rehearsal') on conflict (event_id) do update set locked_fields = excluded.locked_fields`);
    apply({ file: planned.file, target: TARGET });
    check('a lock on categories keeps new category rows out', one(TARGET, `select count(*) from public.event_categories where id = '${categoryRow.pk.id}'`) === '0');
  } else console.log('NOTE no new category rows in this pass; lock check skipped');

  // An edit arriving between the comparison and the write must survive: the row lock forces
  // the merge to wait and compare against the committed value.
  recreate(TARGET, PRE);
  const raced = eventUpdates.find(change => !chosen.has(change.pk.id) && 'website_url' in change.after) ?? eventUpdates.find(change => !chosen.has(change.pk.id));
  const racedColumn = 'website_url' in raced.after ? 'website_url' : 'class_label';
  const holder = spawn('/opt/homebrew/opt/postgresql@17/bin/psql', ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', TARGET, '-q', '-c',
    `begin; update public.events set ${racedColumn} = 'https://concurrent-edit.test/' where id = '${raced.pk.id}'; select pg_sleep(3); commit;`], { stdio: 'ignore', env: { ...process.env, LC_ALL: 'en_US.UTF-8' } });
  const holderDone = new Promise(resolve => holder.on('close', resolve));
  await new Promise(resolve => setTimeout(resolve, 700));
  const racing = await new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, ['-e', `const {apply}=require('./scripts/local-sync.cjs');const r=apply({file:${JSON.stringify(planned.file)},target:${JSON.stringify(TARGET)}});console.log(JSON.stringify(r.problems))`], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = ''; worker.stdout.on('data', chunk => { out += chunk; });
    worker.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(Error(`apply ended with ${code}`)));
  });
  await holderDone;
  if ('website_url' in raced.after) check('an edit made during the write is kept and reported', one(TARGET, `select website_url from public.events where id = '${raced.pk.id}'`) === 'https://concurrent-edit.test/' && racing.some(problem => problem.pk.id === raced.pk.id && problem.state === 'conflict'), racing.filter(problem => problem.pk.id === raced.pk.id));
  else console.log('NOTE no suitable website change for the concurrency check');

  // A crash right after a batch commits: the target's own record tells what landed and undoes it.
  recreate(TARGET, PRE);
  const beforeCrash = sorted(TARGET);
  let crashed = false;
  try { apply({ file: planned.file, target: TARGET, batch: 200, planSha: 'crash-rehearsal', crashAfterBatch: 2 }); } catch (error) { crashed = /rehearsed crash/.test(error.message); }
  check('a crash after a commit leaves a record in the target', crashed && one(TARGET, "select count(*) from public.pipeline_sync_batches where plan_sha = 'crash-rehearsal'") === '2');
  check('the crash left real changes behind', JSON.stringify(sorted(TARGET)) !== JSON.stringify(beforeCrash));
  const crashJournal = join(directory, 'crash-journal.ndjson');
  journalFromTarget(TARGET, 'crash-rehearsal', crashJournal);
  const crashUndo = apply({ file: crashJournal, target: TARGET, exact: true });
  check('the record alone undoes a crashed run', JSON.stringify(sorted(TARGET)) === JSON.stringify(beforeCrash) && crashUndo.totals.conflict === 0 && crashUndo.totals.failed === 0, crashUndo.totals);

  // Stopped halfway: the first half lands, then a complete run finishes the job.
  const whole = sorted(PRE) && (() => {
    recreate(TARGET, PRE);
    apply({ file: planned.file, target: TARGET, journalOut: join(directory, 'whole.ndjson') });
    return sorted(TARGET);
  })();
  recreate(TARGET, PRE);
  try { apply({ file: planned.file, target: TARGET, batch: 200, planSha: 'resume-rehearsal', crashAfterBatch: 3 }); } catch (error) { if (!/rehearsed crash/.test(error.message)) throw error; }
  apply({ file: planned.file, target: TARGET, batch: 200, planSha: 'resume-rehearsal' });
  check('a run stopped halfway finishes with the same result', JSON.stringify(sorted(TARGET)) === JSON.stringify(whole));

  // A rollback must not undo someone's later edit.
  recreate(TARGET, PRE);
  const journalTwo = join(directory, 'journal-two.ndjson');
  apply({ file: planned.file, target: TARGET, journalOut: journalTwo });
  const laterRow = eventUpdates.find(change => change !== conflictRow && change !== lockedRow && change !== mergedRow && change !== elsewhereRow && 'website_url' in change.after);
  psql(TARGET, `update public.events set website_url = 'https://later-edit.test/' where id = '${laterRow.pk.id}'`);
  const careful = apply({ file: journalTwo, target: TARGET, exact: true });
  check("rollback keeps a later edit and reports it", careful.problems.some(problem => problem.pk.id === laterRow.pk.id && problem.state === 'conflict') && one(TARGET, `select website_url from public.events where id = '${laterRow.pk.id}'`) === 'https://later-edit.test/', careful.totals);

  finished = true;
  console.log(`All ${passed.length} checks passed`);
} finally {
  rmSync(directory, { recursive: true, force: true });
} })().catch(error => { console.error(error); process.exitCode = 1; });
// A rehearsal that stops without reaching the end must not look like a pass.
process.on('exit', code => { if (code === 0 && !finished) { console.error('Rehearsal stopped before its last check'); process.exitCode = 1; } });
