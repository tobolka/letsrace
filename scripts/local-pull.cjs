/**
 * Copy the catalogue from the server to the Mac: structure, plus data only from tables
 * explicitly allowed here. Reads only. A table nobody has classified stops the copy, so a
 * future table with people's data cannot slip in unnoticed. Merge history stays out
 * because its snapshots embed favourites and attendance with user identifiers.
 *
 *   node scripts/local-pull.cjs            then: bash scripts/local-db.sh restore
 */
const { execFileSync } = require('node:child_process');
const { chmodSync, mkdirSync, readFileSync, renameSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

const COPY = ['events', 'locations', 'series', 'event_sources', 'event_series', 'event_categories', 'event_facts', 'event_overrides', 'watched_urls',
  'pipeline_tasks', 'pipeline_task_attempts', 'pipeline_candidates', 'ingest_runs', 'page_reads', 'catalog_probes', 'discovered_links', 'duplicate_reviews',
  'extraction_profiles', 'pipeline_extraction_cache', 'pipeline_refresh_receipts', 'pipeline_jobs', 'pipeline_workers'];
const LEAVE_OUT = ['profiles', 'family_members', 'admin_users', 'admin_notifications', 'feedback_requests', 'organizer_claims', 'organizer_edits', 'race_submissions',
  'race_alerts', 'race_alert_deliveries', 'event_favorites', 'event_attendance', 'event_plan_changes', 'plan_change_deliveries', 'plan_digest_deliveries', 'blocked_days', 'blocked_weekends',
  'pipeline_merge_history', 'pipeline_owner_decisions', 'pipeline_sync_batches', 'pipeline_proposals', 'weather_history', 'weather_history_attempts', 'weather_provider_requests', 'weather_provider_usage', 'weather_provider_backoff', 'spatial_ref_sys'];

/**
 * What sending compares against. event_facts is the largest table here and is append-only, so a
 * re-sent fact just finds itself on arrival; run logs, reads and queues say nothing about races.
 * This is about a third of the whole copy.
 */
const TARGET = ['events', 'locations', 'series', 'event_sources', 'event_series', 'event_categories', 'event_overrides', 'watched_urls'];

const BIN = process.env.LOCAL_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin';
const directory = process.env.LOCAL_COPY_DIR ?? join(homedir(), 'Library', 'Application Support', 'LetsRace', 'data', 'local-copy');

function serverEnvironment() {
  const line = readFileSync('.env.local', 'utf8').split('\n').map(text => text.trim()).findLast(text => text.startsWith('SUPABASE_DB_URL='));
  if (!line) throw Error('SUPABASE_DB_URL is missing from .env.local');
  const url = new URL(line.slice('SUPABASE_DB_URL='.length).replace(/^["']|["']$/g, ''));
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1) || 'postgres', PGSSLMODE: 'require', PGAPPNAME: 'letsrace-local-copy', LC_ALL: 'en_US.UTF-8', PGTZ: 'UTC' };
}

function run(tool, args, env) {
  try { return execFileSync(`${BIN}/${tool}`, args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 2 ** 28 }); }
  catch (error) { throw Error(`${tool} failed: ${String(error.stderr ?? error.message).replaceAll(env.PGPASSWORD, '***').slice(0, 400)}`); }
}

function copyTarget() {
const env = serverEnvironment();
checkTables(env);
mkdirSync(directory, { recursive: true });
chmodSync(directory, 0o700);
run('pg_dump', ['--data-only', '--format=custom', ...TARGET.map(table => `--table=public.${table}`), '-f', join(directory, 'target.dump.tmp')], env);
renameSync(join(directory, 'target.dump.tmp'), join(directory, 'target.dump'));
console.log(`Copied ${TARGET.length} tables of the target catalogue to ${join(directory, 'target.dump')}.`);
}

function checkTables(env) {
const tables = run('psql', ['-qAt', '-c', "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname in ('public', 'pipeline_private') order by 1"], env).split('\n').filter(Boolean);
const unknown = tables.filter(table => !COPY.includes(table) && !LEAVE_OUT.includes(table));
if (unknown.length) throw Error(`Decide whether these tables may be copied, then list them in local-pull.cjs: ${unknown.join(', ')}`);
const missing = COPY.filter(table => !tables.includes(table));
if (missing.length) throw Error(`Allowed tables no longer exist: ${missing.join(', ')}`);
}

function copyCatalogue() {
const env = serverEnvironment();
checkTables(env);
mkdirSync(directory, { recursive: true });
chmodSync(directory, 0o700);
run('pg_dump', ['--schema-only', '--no-owner', '--schema=public', '--schema=pipeline_private', '-f', join(directory, 'schema.sql.tmp')], env);
run('pg_dump', ['--data-only', '--format=custom', ...COPY.map(table => `--table=public.${table}`), '-f', join(directory, 'catalogue-baseline.dump.tmp')], env);
renameSync(join(directory, 'schema.sql.tmp'), join(directory, 'schema.sql'));
renameSync(join(directory, 'catalogue-baseline.dump.tmp'), join(directory, 'catalogue-baseline.dump'));
console.log(`Copied structure and ${COPY.length} tables to ${directory}; ${LEAVE_OUT.length} tables left out.`);

}
module.exports = {COPY,LEAVE_OUT,TARGET,serverEnvironment,copyCatalogue,copyTarget};
if(require.main===module)(process.argv.includes('--target-only')?copyTarget:copyCatalogue)();
