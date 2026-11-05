/** One-off 2026-11-06: dates the organisers state themselves, against a calendar's date.
 * node fix-dates.cjs local|server. Earlier state in date-fixes-<target>.json. The dates are locked so a calendar does not bring the old one back. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const fixes = [
  { prefix: '20dafa05', name: 'PGR Poland Gravel Race', from: '2027-07-31', start: '2027-08-07', end: '2027-08-10', url: 'https://pgr.kolo-ultra.pl/registration', quote: 'Date | 7-10.08.2027' },
  { prefix: 'd7ca6e90', name: 'Gravelowa Korona Kujaw i Pomorza - Grudziądz', from: '2027-06-26', start: '2027-06-05', end: '2027-06-06', url: 'https://cdn.prod.website-files.com/6932bdda2669bbb4a20263b1/6abf60f60b448cc8d631d8b6_Regulamin_GKKiP_2027.pdf', quote: 'II EDYCJA – GRUDZIĄDZ – 5–6 czerwca 2027 r.' },
  { prefix: 'ad1c0455', name: 'Gravel Trans Jura', from: '2027-06-03', start: '2027-06-02', end: '2027-06-08', url: 'https://ridegravel.ch/transjura/', quote: '2. bis 8. Juni 2027' },
];
const before = [], after = [];
for (const fix of fixes) {
  const [row] = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'name',name,'start_date',start_date,'end_date',end_date,'merged',merged_into_id)),'[]') from public.events where id::text like '${fix.prefix}%'`));
  if (!row || row.merged || row.name !== fix.name || row.start_date !== fix.from) { after.push(`skipped ${fix.name}: ${row?.start_date}`); continue; }
  before.push(row);
  fs.writeFileSync(path.join(__dirname, `date-fixes-${target}.json`), JSON.stringify({ at: new Date().toISOString(), before }, null, 1));
  after.push(run(`begin;
insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,status) values (${q(row.id)}::uuid,'start_date',${q(JSON.stringify(fix.start))}::jsonb,${q(JSON.stringify(row.start_date))}::jsonb,${q(fix.url)},${q(fix.quote)},'manual_date_fix','date-fix-2026-11-06','active');
update public.events set start_date=${q(fix.start)}::date,end_date=${q(fix.end)}::date where id=${q(row.id)}::uuid returning name,start_date,end_date;
insert into public.event_overrides(event_id,locked_fields) values (${q(row.id)}::uuid,array['start_date','end_date']) on conflict (event_id) do update set locked_fields=(select array(select distinct unnest(public.event_overrides.locked_fields||array['start_date','end_date'])));
commit;`).trim());
}
console.log(target, after.join('\n'));
