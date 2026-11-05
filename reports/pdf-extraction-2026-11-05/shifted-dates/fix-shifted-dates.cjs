/** One-off 2026-11-06: dates of 2026 that were given the year 2027, and so were never announced.
 * CUBE Cup's site headed "2027" over its 2026 table; the organiser says 2027 news comes from mid-November. Those races are hidden until then.
 * RoadCup: an earlier AI reading of its 2026 table. Corrected to the organiser's 2027 table, https://www.roadcycling.cz/roadcup/rocnik-2027
 * node fix-shifted-dates.cjs local|server. Earlier state in shifted-<target>.json. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const ROADCUP = 'https://www.roadcycling.cz/roadcup/rocnik-2027';
const dates = [
  { prefix: 'e5ac08b2', from: '2027-06-07', to: '2027-06-06', url: ROADCUP, quote: 'VELKÁ CENA BÍLINY - O Radovesickou kostku RR 83,3 km 06.06.2027' },
  { prefix: '2f2a06e4', from: '2027-08-09', to: '2027-08-08', url: ROADCUP, quote: 'Most - Lesná RR 67 km 08.08.2027' },
  { prefix: 'dff4dd08', from: '2027-08-30', to: '2027-08-29', url: ROADCUP, quote: 'LAWI Tour RR 100 km 29.08.2027' },
  { prefix: 'e019271d', from: '2027-06-21', to: '2027-06-06', url: 'http://www.frankenbikemarathon.de/', quote: 'Termin: Sonntag, 06.06.2027', website: 'http://www.frankenbikemarathon.de/' },
];
const merges = [ { keep: '28451850', drop: '6b7a561e' }, { keep: '28451850', drop: '53fa2d87' }, { keep: '373137a4', drop: '6af06c8b' } ];
const id = prefix => run(`select id from public.events where id::text like '${prefix}%'`).trim();
const log = [], journal = { at: new Date().toISOString(), dates: [], hidden: [], merged: [] };
const save = () => fs.writeFileSync(path.join(__dirname, `shifted-${target}.json`), JSON.stringify(journal, null, 1));
for (const fix of dates) {
  const raceId = id(fix.prefix);
  const [row] = raceId ? JSON.parse(run(`select json_agg(json_build_object('id',id,'name',name,'start_date',start_date,'end_date',end_date,'website_url',website_url)) from public.events where id='${raceId}'`)) : [];
  if (!row || row.start_date !== fix.from) { log.push(`skipped ${fix.prefix}: ${row?.start_date}`); continue; }
  journal.dates.push(row); save();
  run(`begin;
insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,status) values (${q(raceId)}::uuid,'start_date',${q(JSON.stringify(fix.to))}::jsonb,${q(JSON.stringify(fix.from))}::jsonb,${q(fix.url)},${q(fix.quote)},'manual_date_fix','date-fix-2026-11-06','active');
update public.events set start_date=${q(fix.to)}::date,end_date=${q(fix.to)}::date${fix.website ? `,website_url=${q(fix.website)}` : ''} where id=${q(raceId)}::uuid;
insert into public.event_overrides(event_id,locked_fields) values (${q(raceId)}::uuid,array['start_date','end_date']) on conflict (event_id) do update set locked_fields=(select array(select distinct unnest(public.event_overrides.locked_fields||array['start_date','end_date'])));
commit;`);
  log.push(`${row.name}: ${fix.from} -> ${fix.to}`);
}
for (const pair of merges) {
  const keep = id(pair.keep), drop = id(pair.drop);
  const live = keep && drop ? run(`select count(*) from public.events where id in ('${keep}','${drop}') and merged_into_id is null`).trim() : '0';
  if (live !== '2') { log.push(`skipped merge ${pair.drop}`); continue; }
  run(`select public.app_merge_events('${keep}'::uuid,'${drop}'::uuid)`);
  journal.merged.push(pair); save(); log.push(`merged ${pair.drop} into ${pair.keep}`);
}
const cube = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'name',name,'start_date',start_date,'status',status,'visibility',visibility)),'[]') from public.events where merged_into_id is null and name like 'CUBE Cup — %' and start_date>='2027-01-01' and visibility='public' and id::text not like 'e019271d%' and exists (select 1 from public.event_sources s where s.event_id=events.id and s.external_id like 'cube-cup-%')`));
journal.hidden = cube; save();
if (cube.length) {
  const ids = cube.map(row => `'${row.id}'::uuid`).join(',');
  run(`begin;
insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,status) select id,'visibility','"hidden"'::jsonb,'"public"'::jsonb,'https://cup.cube.eu/','Ab Mitte November gibt es die ersten News zur neuen Saison.','manual_hide','hide-2026-11-06','active' from public.events where id in (${ids});
update public.events set visibility='hidden',status='hidden' where id in (${ids});
commit;`);
}
log.push(`hidden CUBE Cup races: ${cube.length}`);
console.log(target, log.join('\n'));
