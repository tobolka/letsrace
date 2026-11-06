/** Removes details the review of 6 Nov 2026 found wrong. Earlier state in removed-<target>.json. node remove-wrong.cjs local|server */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', env, maxBuffer: 1e8 }).trim();
const wrong = [{ name: 'FILIPA Podkrkonošský maraton', start: '2027-07-31', field: 'fees' }, { name: '8º TROFEO LE VALLI SUL MINCIO', start: '2026-11-08', field: 'venue' }];
const log = [];
for (const { name, start, field } of wrong) {
  const q = name.replaceAll("'", "''");
  const row = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'value',practical_details->'${field}')),'[]') from public.events where name='${q}' and start_date='${start}' and merged_into_id is null`))[0];
  if (!row?.value) { log.push({ name, field, skipped: true }); continue; }
  log.push({ name, field, id: row.id, before: row.value });
  run(`begin; update public.events set practical_details=practical_details-'${field}' where id='${row.id}'; update public.event_facts set status='rolled_back' where event_id='${row.id}' and field='practical.${field}' and status='active'; commit;`);
}
fs.writeFileSync(path.join(__dirname, `removed-${target}.json`), JSON.stringify(log, null, 1));
console.log(target, log.map(l => `${l.name}: ${l.field} ${l.skipped ? 'nebylo' : 'odstraněno'}`));
