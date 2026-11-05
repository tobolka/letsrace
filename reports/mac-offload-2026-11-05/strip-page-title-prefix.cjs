/** One-off 2026-11-05: "Termine 2027 — 35. GP von Buchholz" is "35. GP von Buchholz".
 * node reports/mac-offload-2026-11-05/strip-page-title-prefix.cjs local|server
 * The earlier names go to rename-journal-<target>.json. A record whose clean name would collide
 * with another race is left as it is and listed, since that is a duplicate to look at. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', maxBuffer: 2 ** 26, env });
const rows = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',id,'name',name,'name_normalized',name_normalized,'fingerprint',fingerprint,'start_date',start_date)),'[]') from public.events where name like 'Termine 2027 — %' and merged_into_id is null`));
fs.writeFileSync(path.join(__dirname, `rename-journal-${target}.json`), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const done = [], kept = [];
for (const row of rows) {
  const name = row.name.replace(/^Termine 2027 — /, '');
  const normalized = (row.name_normalized ?? '').replace(/^termine 2027\s+/, '');
  const fingerprint = (row.fingerprint ?? '').replace(/:termine 2027\s+/, ':');
  if (run(`select count(*) from public.events where id<>${q(row.id)}::uuid and fingerprint=${q(fingerprint)}`).trim() !== '0') { kept.push(row.name); continue; }
  run(`begin; update public.events set name=${q(name)},name_normalized=${q(normalized)},fingerprint=${q(fingerprint)} where id=${q(row.id)}::uuid; insert into public.event_facts(event_id,field,value,previous,source_url,method,version,status) values (${q(row.id)}::uuid,'name',${q(JSON.stringify(name))}::jsonb,${q(JSON.stringify(row.name))}::jsonb,'https://www.dsergebnis.de/','manual_rename','rename-2026-11-05','active'); commit;`);
  done.push(name);
}
console.log(JSON.stringify({ target, renamed: done.length, kept }));
console.log(done.join(' | '));
