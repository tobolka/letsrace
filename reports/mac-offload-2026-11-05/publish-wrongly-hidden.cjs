/** One-off 2026-11-05: real races left hidden. Four cyclo-cross races and a gran fondo were created
 * on 13 August, while races in Italy without a link were still hidden, and nothing showed them
 * again after Italy opened on 29 August. Cross del Sile was hidden for the federation's 31 December
 * placeholder, but TrevisoMTB states that day too. Each has at least two independent sources.
 * node reports/mac-offload-2026-11-05/publish-wrongly-hidden.cjs local|server
 * The earlier state goes to unhide-journal-<target>.json. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-F', ' | ', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const slugs = ['abbinata-naz-turin-international-cyclocross-2026', 'abbinata-naz-11-ciclocross-del-brenta-2026', 'ciclocross-del-ponte-internazionale-cx-2026', 'internazionale-ciclocross-3-cx-la-montagnetta-bari-2026', '5-cross-del-sile-2026', 'granfondo-sanremo-sanremo-2027'];
const where = `merged_into_id is null and visibility='hidden' and slug in (${slugs.map(slug => `'${slug}'`).join(',')})`;
const before = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'start_date',start_date,'status',status,'visibility',visibility)),'[]') from public.events where ${where}`));
if (before.length !== slugs.length) throw Error(`Expected ${slugs.length} races, found ${before.length}: ${before.map(r => r.name).join(', ')}`);
fs.writeFileSync(path.join(__dirname, `unhide-journal-${target}.json`), JSON.stringify({ at: new Date().toISOString(), before }, null, 1));
const ids = before.map(r => `'${r.id}'::uuid`).join(',');
const output = run(`begin;
insert into public.event_facts(event_id,field,value,previous,method,version,status) select id,'visibility','"public"'::jsonb,'"hidden"'::jsonb,'manual_unhide','unhide-2026-11-05','active' from public.events where id in (${ids});
update public.events set visibility='public',status=case when status='hidden' then 'scheduled' else status end where id in (${ids}) returning slug,start_date,status,visibility;
commit;`);
console.log(target); console.log(output);
