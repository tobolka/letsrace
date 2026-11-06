/** Sends races read by hand in the session to the server: their details and links, with evidence. Earlier state in sent-before.json. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const PSQL = '/opt/homebrew/opt/postgresql@17/bin/psql';
const local = s => cp.execFileSync(PSQL, ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', s], { encoding: 'utf8', maxBuffer: 1e9, env: { ...process.env, NODE_OPTIONS: '' } }).trim();
const envS = { ...serverEnvironment(), NODE_OPTIONS: '' };
const server = s => cp.execFileSync(PSQL, ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', s], { encoding: 'utf8', maxBuffer: 1e9, env: envS }).trim();
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const ids = [...new Set(fs.readFileSync(path.join(__dirname, 'golden.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l).id))];
const list = ids.map(q).join(',');
const select = `select coalesce(json_agg(t),'[]') from (select e.id,e.name,e.start_date,e.practical_details,e.website_url,e.regulations_url,e.results_url,e.registration_url,o.locked_fields from public.events e left join public.event_overrides o on o.event_id=e.id where e.id in (${list})) t`;
const work = new Map(JSON.parse(local(select)).map(r => [r.id, r]));
const held = JSON.parse(server(select));
fs.writeFileSync(path.join(__dirname, 'sent-before.json'), JSON.stringify(held, null, 1));
const log = [];
for (const row of held) {
  const mine = work.get(row.id);
  if (!mine || mine.start_date !== row.start_date) { log.push(`${row.name}: vynecháno, jiné datum`); continue; }
  const locks = row.locked_fields ?? [];
  const details = { ...row.practical_details };
  const changed = [];
  for (const [field, fact] of Object.entries(mine.practical_details ?? {})) {
    if (locks.includes('practical_details') || locks.includes(`practical.${field}`)) continue;
    if (JSON.stringify(details[field]?.value) !== JSON.stringify(fact.value)) { details[field] = fact; changed.push(field); }
  }
  const links = {};
  for (const field of ['website_url', 'regulations_url', 'results_url', 'registration_url']) if (mine[field] && mine[field] !== row[field] && !locks.includes(field) && (field !== 'registration_url' || !row[field])) links[field] = mine[field];
  if (!changed.length && !Object.keys(links).length) { log.push(`${row.name}: beze změny`); continue; }
  const sets = [...(changed.length ? [`practical_details=${q(JSON.stringify(details))}::jsonb`] : []), ...Object.entries(links).map(([f, v]) => `${f}=${q(v)}`)];
  const facts = changed.map(field => { const f = details[field]; return `(${q(row.id)}::uuid,${q('practical.' + field)},${q(JSON.stringify(f))}::jsonb,${row.practical_details?.[field] ? q(JSON.stringify(row.practical_details[field])) + '::jsonb' : 'null'},${q(f.sourceUrl)},${q(String(f.quote).slice(0, 1500))},'session_reading','1','active')`; });
  server(`begin; update public.events set ${sets.join(',')} where id=${q(row.id)}::uuid;${facts.length ? ` insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,status) values ${facts.join(',')};` : ''} commit;`);
  log.push(`${row.name.slice(0, 44)}: ${changed.join(',') || '-'} | ${Object.keys(links).join(',') || '-'}`);
}
console.log(log.join('\n'));
