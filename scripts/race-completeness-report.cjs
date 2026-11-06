/** How far known upcoming races are from what a rider needs, field by field. Read-only.
 * node scripts/race-completeness-report.cjs [local|server] [--days=60] */
const cp = require('node:child_process');
const { serverEnvironment } = require('./local-pull.cjs');
const target = process.argv[2] === 'local' ? 'local' : 'server';
const days = Number(process.argv.find(a => a.startsWith('--days='))?.slice(7) ?? 0);
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const scope = `e.visibility='public' and e.merged_into_id is null and e.start_date>=current_date${days ? ` and e.start_date<current_date+${days}` : ''}`;
const has = field => `(e.practical_details ? '${field}')::int`;
const sql = `select coalesce(json_agg(t),'[]') from (select coalesce(l.country_code,'?') country,count(*) races,
 sum(((e.practical_details ? 'categories') or coalesce(cardinality(e.age_categories),0)>0)::int) "Kategorie (obecné)",sum(${has('categories')}) "Kategorie z propozic",
 sum(${has('organizer')}) "Pořadatel",sum((e.practical_details->'organizer'->'value' ?| array['phone','email'])::int) "Kontakt",
 sum(${has('fees')}) "Startovné",sum(${has('routes')}) "Tratě",sum(${has('schedule')}) "Harmonogram",sum(${has('parking')}) "Parkování",
 sum((e.registration_url is not null)::int) "Registrace",sum((e.results_url is not null or e.registration_url ~* 'maraton\\.cz|marathon\\.cz|sumator\\.cz|raceresult|racetime|sportsoft|stopsport|time-sport')::int) "Výsledky (aspoň server)",
 sum((e.regulations_url is not null)::int) "Propozice",sum((e.website_url is not null and e.website_url !~ '^https?://[^/]+/?$')::int) "Vlastní stránka závodu"
 from public.events e left join public.locations l on l.id=e.location_id where ${scope} group by 1) t`;
const rows = JSON.parse(cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-c', sql], { encoding: 'utf8', env }));
const fields = Object.keys(rows[0] ?? {}).filter(k => !['country', 'races'].includes(k));
const total = (list, key) => list.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
const line = (label, list) => { const n = total(list, 'races'); return { label, races: n, ...Object.fromEntries(fields.map(f => [f, `${total(list, f)} (${n ? Math.round(100 * total(list, f) / n) : 0} %)`])) }; };
const first = rows.filter(r => ['CZ', 'SK'].includes(r.country));
const report = { target, days: days || 'all', at: new Date().toISOString(), all: line('Vše', rows), czsk: line('CZ + SK', first) };
console.log(JSON.stringify(report, null, 1));
