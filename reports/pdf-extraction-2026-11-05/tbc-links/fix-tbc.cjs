/** One-off 2026-11-06: TBC races linked to homepages, clubs or other calendars, though the series has a page for each race.
 * The date on each page is checked before anything is written. tbcserie.cz/pravidla is the series' rulebook, not a race's regulations,
 * so it leaves that button. node fix-tbc.cjs local|server. Earlier state in tbc-<target>.json. */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', env, maxBuffer: 1e8 }).trim();
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const PAGES = {
  'tbc-bernarticky-cyklokros-2026': 194, 'galaxy-cyklosvec-cyklokros-kukle-kukle-u-talina-2026': 197, 'tbc-cyklokros-chynov-2026': 199,
  'tbc-cirkus-cyklokros-strakonice-2026': 215, 'tbc-litvinovice-2026': 213, 'tbc-tabor-2026': 217, 'tbc-hurka-2026': 203,
  'cyklokros-na-vodniku-vimperk-2026': 211, 'cyklokros-prachatice-2026': 216, 'zabacky-cyklokros-memorial-rudolfa-bartose-2026': 201, 'tbc-veseli-nad-luznici-2026': 214,
};
const czDate = iso => { const [y, m, d] = iso.split('-'); return `${d}. ${m}. ${y}`; };
(async () => {
  const journal = { at: new Date().toISOString(), before: [], done: [], skipped: [] };
  const save = () => fs.writeFileSync(path.join(__dirname, `tbc-${target}.json`), JSON.stringify(journal, null, 1));
  for (const [slug, page] of Object.entries(PAGES)) {
    const url = `https://tbcserie.cz/kalendar-2026/zavod-${page}/`;
    const [row] = JSON.parse(run(`select coalesce(json_agg(json_build_object('id',e.id,'slug',e.slug,'name',e.name,'start_date',e.start_date,'website_url',e.website_url,'regulations_url',e.regulations_url,'locks',o.locked_fields)),'[]') from public.events e left join public.event_overrides o on o.event_id=e.id where e.slug=${q(slug)} and e.merged_into_id is null`));
    if (!row) { journal.skipped.push({ slug, why: 'no such race' }); continue; }
    const html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 letsrace' } })).text();
    if (!html.includes(`Termín: ${czDate(row.start_date)}`)) { journal.skipped.push({ slug, url, why: `page does not state ${row.start_date}` }); save(); continue; }
    journal.before.push(row); save();
    const rules = row.regulations_url && /tbcserie\.cz\/pravidla/.test(row.regulations_url);
    run(`begin;
insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,status) values (${q(row.id)}::uuid,'website_url',${q(JSON.stringify(url))}::jsonb,${q(JSON.stringify(row.website_url))}::jsonb,${q(url)},${q(`Termín: ${czDate(row.start_date)}`)},'manual_review','1','active');
update public.events set website_url=${q(url)}${rules ? ',regulations_url=null' : ''} where id=${q(row.id)}::uuid;
insert into public.event_overrides(event_id,locked_fields) values (${q(row.id)}::uuid,array['website_url']) on conflict (event_id) do update set locked_fields=(select array(select distinct unnest(coalesce(public.event_overrides.locked_fields,'{}')||array['website_url'])));
commit;`);
    journal.done.push({ slug, url, from: row.website_url, clearedRules: Boolean(rules) }); save();
  }
  console.log(journal.done.map(d => `${d.slug}: ${d.from} -> ${d.url}${d.clearedRules ? ' (bez pravidel)' : ''}`).join('\n'));
  console.log('skipped', journal.skipped);
})().catch(e => { console.error(String(e.message).split('\n').slice(0, 4).join(' ')); process.exit(1); });
