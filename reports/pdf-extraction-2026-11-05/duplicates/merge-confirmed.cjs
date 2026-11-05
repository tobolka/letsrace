/** One-off 2026-11-06: races listed twice, read and decided by hand; see RESULT.md beside this file.
 * node merge-confirmed.cjs <pairs.json> local|server
 * Goes through the audited public.app_merge_events, so public.app_restore can undo each merge. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const [, , pairsFile, target] = process.argv;
if (!['local', 'server'].includes(target)) throw Error('local or server');
const pairs = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const done = [], skipped = [];
for (const p of pairs) {
  const rows = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'name',name,'merged',merged_into_id,'slug',slug)),'[]') from public.events where id in ('${p.keep}'::uuid,'${p.drop}'::uuid)`));
  const keep = rows.find(r => r.id === p.keep), drop = rows.find(r => r.id === p.drop);
  if (!keep || !drop || keep.merged || drop.merged || keep.name !== p.keepName || drop.name !== p.dropName) { skipped.push({ ...p, why: !keep || !drop ? 'missing here' : 'changed since read' }); continue; }
  run(`select public.app_merge_events('${p.keep}'::uuid,'${p.drop}'::uuid)`);
  done.push({ keep: keep.slug, drop: drop.slug, why: p.why });
}
fs.writeFileSync(path.join(__dirname, `merged-${target}.json`), JSON.stringify({ at: new Date().toISOString(), done, skipped }, null, 1));
console.log(JSON.stringify({ target, merged: done.length, skipped }, null, 0));
