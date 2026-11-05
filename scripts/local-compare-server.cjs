/**
 * Is the Mac's copy really the same as the server where it matters? Compares the exact
 * definitions of functions, triggers and columns, then what PostGIS answers for the same
 * places, within a tolerance. Reads only. Run after local-pull and local-db.sh restore.
 *
 *   node scripts/local-compare-server.cjs [--out=file.json]
 */
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

const BIN = process.env.LOCAL_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin';
const line = readFileSync('.env.local', 'utf8').split('\n').map(text => text.trim()).findLast(text => text.startsWith('SUPABASE_DB_URL='));
const url = new URL(line.slice('SUPABASE_DB_URL='.length).replace(/^["']|["']$/g, ''));
const SERVER = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1) || 'postgres', PGSSLMODE: 'require', PGAPPNAME: 'letsrace-local-compare', LC_ALL: 'en_US.UTF-8', PGTZ: 'UTC' };
const LOCAL = { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54329', PGUSER: 'postgres', PGDATABASE: 'letsrace_baseline', LC_ALL: 'en_US.UTF-8', PGTZ: 'UTC' };
const read = (env, sql) => JSON.parse(execFileSync(`${BIN}/psql`, ['-qAt', '-c', sql], { encoding: 'utf8', env, maxBuffer: 2 ** 30 }));

const OWN_FUNCTION = `n.nspname in ('public', 'pipeline_private') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`;
const CHECKS = {
  functions: `select coalesce(json_object_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', md5(pg_get_functiondef(p.oid))), '{}') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prokind in ('f', 'p') and ${OWN_FUNCTION}`,
  triggers: `select coalesce(json_object_agg(c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))), '{}') from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public', 'pipeline_private')`,
  columns: `select coalesce(json_object_agg(table_name || '.' || column_name, md5(data_type || coalesce(column_default, '') || is_nullable)), '{}') from information_schema.columns where table_schema in ('public', 'pipeline_private') and table_name <> 'spatial_ref_sys' and table_name not in (select extname from pg_extension)`,
  constraints: `select coalesce(json_object_agg(c.conrelid::regclass::text || '.' || c.conname, md5(pg_get_constraintdef(c.oid))), '{}') from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname in ('public', 'pipeline_private') and c.conrelid <> 0`,
  policies: `select coalesce(json_object_agg(tablename || '.' || policyname, md5(coalesce(qual, '') || coalesce(with_check, '') || cmd)), '{}') from pg_policies where schemaname in ('public', 'pipeline_private')`,
};
// The same real places on both sides: what the map and the near-me search depend on.
const POSTGIS = `select coalesce(json_object_agg(id, json_build_object('lat', extensions_lat, 'lng', extensions_lng, 'km', km)), '{}') from (
  select id, public.st_y(geog::public.geometry) as extensions_lat, public.st_x(geog::public.geometry) as extensions_lng,
    public.st_distance(geog, public.st_setsrid(public.st_makepoint(14.42, 50.09), 4326)::public.geography) / 1000 as km
  from public.locations where geog is not null order by id limit 3000) x`;

const report = { at: new Date().toISOString(), definitions: {}, postgis: {} };
let problems = 0;
for (const [name, sql] of Object.entries(CHECKS)) {
  const server = read(SERVER, sql), local = read(LOCAL, sql);
  const onlyServer = Object.keys(server).filter(key => !(key in local));
  const onlyLocal = Object.keys(local).filter(key => !(key in server));
  const different = Object.keys(server).filter(key => key in local && server[key] !== local[key]);
  report.definitions[name] = { compared: Object.keys(server).length, onlyServer, onlyLocal, different };
  problems += onlyServer.length + onlyLocal.length + different.length;
}
try {
  const server = read(SERVER, POSTGIS), local = read(LOCAL, POSTGIS);
  const ids = Object.keys(server).filter(id => id in local);
  const off = ids.filter(id => Math.abs(server[id].lat - local[id].lat) > 1e-7 || Math.abs(server[id].lng - local[id].lng) > 1e-7 || Math.abs(server[id].km - local[id].km) > 0.01);
  report.postgis = { compared: ids.length, missing: Object.keys(server).length - ids.length, beyondTolerance: off.length, worstKm: Math.max(0, ...ids.map(id => Math.abs(server[id].km - local[id].km))) };
  problems += off.length;
} catch (error) { report.postgis = { error: String(error.stderr ?? error.message).replaceAll(SERVER.PGPASSWORD, '***').slice(0, 300) }; problems++; }
const out = process.argv.find(value => value.startsWith('--out='))?.slice(6);
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1).slice(0, 3000));
console.log(problems ? `${problems} differences to explain` : 'No differences');
