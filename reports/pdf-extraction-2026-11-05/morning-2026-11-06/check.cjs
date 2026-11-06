/** Read-only morning check of what visitors see: hidden races, corrected dates, merged addresses, details sent overnight. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const R = path.join(__dirname, '..');
const env = { ...serverEnvironment(), NODE_OPTIONS: '' };
const sql = s => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', s], { encoding: 'utf8', env }).trim();
const rows = s => JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (${s}) t`));
const get = async u => { try { const r = await fetch(u, { redirect: 'manual', headers: { 'user-agent': 'letsrace-check' } }); return { status: r.status, location: r.headers.get('location'), body: r.status === 200 ? await r.text() : '' }; } catch (e) { return { status: 0, error: String(e) }; } };
const base = 'https://letsrace.cz/cs/zavod/';
const q = s => `'${String(s).replaceAll("'", "''")}'`;
(async () => {
  const out = {};
  const shifted = JSON.parse(fs.readFileSync(path.join(R, 'shifted-dates/shifted-server.json')));
  const hiddenIds = shifted.hidden.map(h => h.id);
  const hidden = hiddenIds.length ? rows(`select id,name,slug,status,visibility,start_date from public.events where id in (${hiddenIds.map(q).join(',')})`) : [];
  out.hidden = [];
  for (const h of hidden) { const r = await get(base + h.slug); out.hidden.push({ name: h.name, slug: h.slug, status: h.status, http: r.status, location: r.location }); }
  const fixed = [...shifted.dates.map(d => d.id), ...JSON.parse(fs.readFileSync(path.join(R, 'duplicates/date-fixes-server.json'))).before.map(d => d.id)];
  const dated = rows(`select id,name,slug,start_date,end_date from public.events where id in (${fixed.map(q).join(',')})`);
  out.dates = [];
  for (const d of dated) { const r = await get(base + d.slug); const [y, m, day] = d.start_date.split('-').map(Number); const shows = [`${day}. ${m}. ${y}`, `${day}.${m}.${y}`, d.start_date].some(x => r.body.includes(x)); out.dates.push({ name: d.name, db: d.start_date, http: r.status, shows }); }
  const merged = JSON.parse(fs.readFileSync(path.join(R, 'duplicates/merged-server.json'))).done;
  out.merged = [];
  for (const m of merged) { const r = await get(base + m.drop); out.merged.push({ drop: m.drop, keep: m.keep, http: r.status, location: r.location }); }
  const facts = rows(`select e.slug,e.name,count(*) n,min(f.created_at) first_at from public.event_facts f join public.events e on e.id=f.event_id where f.field like 'practical.%' and f.status='active' and f.created_at>now()-interval '36 hours' and e.merged_into_id is null group by 1,2 order by first_at desc`);
  out.detailsRaces = facts.length;
  out.details = [];
  for (const f of facts) { const r = await get(base + f.slug); out.details.push({ slug: f.slug, facts: Number(f.n), http: r.status, section: r.body.includes('Před cestou na závod') }); }
  out.totals = rows(`select extract(year from start_date)::int y,count(*) n from public.events where merged_into_id is null and start_date>='2026-11-01' group by 1 order by 1`);
  fs.writeFileSync(path.join(__dirname, 'public-check.json'), JSON.stringify(out, null, 1));
  const s = a => a.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
  console.log('hidden', s(out.hidden.map(x => x.http)), out.hidden.filter(x => x.http === 200).map(x => x.slug));
  console.log('dates', out.dates.map(d => `${d.name.slice(0, 30)} ${d.db} ${d.http} ${d.shows ? 'ok' : 'NOT SHOWN'}`));
  console.log('merged', s(out.merged.map(x => x.http)), out.merged.filter(x => ![301, 302, 307, 308].includes(x.http)).map(x => x.drop));
  console.log('details races', out.detailsRaces, 'http', s(out.details.map(x => x.http)), 'section shown', out.details.filter(x => x.section).length, 'missing', out.details.filter(x => x.http === 200 && !x.section).map(x => x.slug).slice(0, 15));
  console.log('totals', out.totals);
})().catch(e => { console.error(String(e.message).split('\n').slice(0, 4).join(' ')); process.exit(1); });
