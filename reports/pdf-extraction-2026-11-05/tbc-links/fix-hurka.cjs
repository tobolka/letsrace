/** One-off 2026-11-06: Hůrecký krpál has its organiser's page and full regulations, found by the owner. node fix-hurka.cjs local|server */
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
const { serverEnvironment } = require('../../../scripts/local-pull.cjs');
const target = process.argv[2];
if (!['local', 'server'].includes(target)) throw Error('local or server');
const args = target === 'local' ? ['-h', '127.0.0.1', '-p', '54329', '-U', 'postgres', '-d', 'letsrace'] : [];
const env = target === 'local' ? { ...process.env, NODE_OPTIONS: '' } : { ...serverEnvironment(), NODE_OPTIONS: '' };
const run = sql => cp.execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', [...args, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', env }).trim();
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const web = 'https://spsvd.cz/hurecky-krpal/', pdf = 'https://spsvd.cz/wp-content/uploads/2026/10/2026_Hurecky_krpal_cyklokros_propozice.pdf';
const [row] = JSON.parse(run(`select json_agg(json_build_object('id',id,'website_url',website_url,'regulations_url',regulations_url)) from public.events where slug='tbc-hurka-2026'`));
fs.writeFileSync(path.join(__dirname, `hurka-${target}.json`), JSON.stringify(row, null, 1));
run(`begin;
insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,status) values (${q(row.id)}::uuid,'website_url',${q(JSON.stringify(web))}::jsonb,${q(JSON.stringify(row.website_url))}::jsonb,${q(web)},'Hurecký krpál 2026','manual_review','1','active'),(${q(row.id)}::uuid,'regulations_url',${q(JSON.stringify(pdf))}::jsonb,${q(JSON.stringify(row.regulations_url))}::jsonb,${q(pdf)},'Datum Sobota 7.11.2026 Místo Hůrka u Jistebnice','manual_review','1','active');
update public.events set website_url=${q(web)},regulations_url=${q(pdf)} where id=${q(row.id)}::uuid;
insert into public.event_overrides(event_id,locked_fields) values (${q(row.id)}::uuid,array['website_url','regulations_url']) on conflict (event_id) do update set locked_fields=(select array(select distinct unnest(coalesce(public.event_overrides.locked_fields,'{}')||array['website_url','regulations_url'])));
commit;`);
console.log(target, 'done');
