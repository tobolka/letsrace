/** One-off 2026-11-06: two venues sent by the first regulations batch belong to other events.
 * Afeno Quer und Bike Cup #5 is in Möhlin on 7.11.; "Muttenz" is the 14.11. round of the same document.
 * Rowerowy Rajd Niepodległości is in Świecie on 7.11.; "Plac przed Chojnickim Centrum Kultury" is a ride in Chojnice on 11.11.
 * node remove-wrong-venues.cjs local|server. The earlier state goes to venue-removal-<target>.json. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const ids = ['4d220c62-c3ea-4257-a6df-a662a0f58cab', '475a8fae-cc3e-4305-b41a-fa3fc8261aa5'], list = ids.map(id => `'${id}'::uuid`).join(',');
const expected = { '4d220c62-c3ea-4257-a6df-a662a0f58cab': 'Muttenz BL', '475a8fae-cc3e-4305-b41a-fa3fc8261aa5': 'Plac przed Chojnickim Centrum Kultury' };
const before = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'name',name,'practical_details',practical_details)),'[]') from public.events where id in (${list})`));
for (const row of before) if (row.practical_details.venue?.value?.name !== expected[row.id]) throw Error(`Unexpected venue on ${row.name}: ${row.practical_details.venue?.value?.name}`);
fs.writeFileSync(path.join(__dirname, `venue-removal-${target}.json`), JSON.stringify({ at: new Date().toISOString(), before }, null, 1));
console.log(target, run(`begin;
update public.event_facts set status='rejected' where event_id in (${list}) and field='practical.venue' and status='active';
update public.events set practical_details=practical_details-'venue' where id in (${list}) returning slug, practical_details ? 'venue';
commit;`));
