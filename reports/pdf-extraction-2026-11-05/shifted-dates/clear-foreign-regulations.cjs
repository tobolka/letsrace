/** One-off 2026-11-06: maraton.cz's terms of the race at Velešín (17.11.) were attached to five other races.
 * node clear-foreign-regulations.cjs local|server. Earlier state in foreign-regulations-<target>.json. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const where = `regulations_url='http://maraton.cz/terms/20261117_velesin.pdf' and merged_into_id is null and name not ilike '%velešín%' and name not ilike '%velesin%'`;
const before = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'name',name,'start_date',start_date,'regulations_url',regulations_url,'practical_details',practical_details)),'[]') from public.events where ${where}`));
fs.writeFileSync(path.join(__dirname, `foreign-regulations-${target}.json`), JSON.stringify({ at: new Date().toISOString(), before }, null, 1));
if (before.length) console.log(target, run(`begin;
update public.event_facts set status='rejected' where field='regulations_url' and status='active' and event_id in (select id from public.events where ${where});
update public.events set regulations_url=null where ${where} returning name;
commit;`)); else console.log(target, 'nothing to clear');
