/** One-off 2026-11-05: separate races glued into one record, from what their own sources state.
 * node reports/mac-offload-2026-11-05/split-linked-races.cjs local|server [--dry-run]
 * Writes the rows as they were to split-journal-<target>.json, so each change can be undone.
 * A detached source row is filed again by the next read as its own race, through the usual gates. */
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {serverEnvironment}=require('../../scripts/local-pull.cjs');
const target=process.argv[2],dry=process.argv.includes('--dry-run');
if(!['local','server'].includes(target))throw Error('local or server');
const BIN='/opt/homebrew/opt/postgresql@17/bin/psql';
const run=(sql)=>cp.execFileSync(BIN,target==='local'?['-h','127.0.0.1','-p','54329','-U','postgres','-d','letsrace','-qAt','-v','ON_ERROR_STOP=1','-c',sql]:['-qAt','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',maxBuffer:2**28,env:target==='local'?{...process.env,NODE_OPTIONS:''}:{...serverEnvironment(),NODE_OPTIONS:''}});
const R=(n,d)=>`radsport-${n}-${d}`;
const OERV='oerv-2EC3871759BE48719C07CFEE931B64FD-2027-07-24';
const plan=[
 {id:'42a8938e-a82e-4e0d-b1d6-cee15928b95f',date:'2027-03-20',source:'https://radsport-events.de/events/18',detach:[R(123,'2027-05-15')]},
 {id:'d8f51434-c3c1-446d-80df-2284f1c00b52',date:'2027-04-10',source:'https://radsport-events.de/events/52',detach:[R(17,'2027-03-20'),R(301,'2027-06-11')]},
 {id:'94bba7c5-2eea-44bb-a59a-08e43e881007',date:'2027-03-20',source:'https://radsport-events.de/events/16',detach:[R(47,'2027-04-10')]},
 {id:'fffd8bed-6d22-4de0-a008-e013b42d5858',date:'2027-03-06',source:'https://radsport-events.de/events/15',detach:[R(27809,'2027-03-20'),R(46,'2027-04-03'),R(125,'2027-04-24')]},
 {id:'5b3e295b-52a7-4c14-b0de-f6f01804fa23',date:'2027-05-29',source:'https://radsport-events.de/events/172',detach:[R(8,'2027-04-17')]},
 {id:'0f0aaad1-6d69-4252-8691-ae6d76d777d9',date:'2027-04-30',source:'https://radsport-events.de/events/27851',website:'https://www.audaxsuisse.ch/brevets/brm-400-stuttgart-odyssey/',detach:[R(27035,'2027-04-17'),R(27852,'2027-05-01')]},
 {id:'f611e53a-7eb2-4b30-a343-9041cb4fce71',date:'2026-10-03',source:'https://radsport-events.de/events/558',detach:[R(266,'2027-06-25'),R(168,'2027-05-08'),R(126,'2027-04-24')]},
 {id:'b0f9c209-53c0-4534-94c8-7ea00fe68a0a',date:'2027-05-08',source:'https://radsport-events.de/events/130',detach:[R(537,'2027-09-11'),R(233,'2027-05-15')],moveOut:{external:R(26779,'2027-03-20'),to:'c90d4f52-b07f-4569-aad5-794e12e169cf'}},
 {id:'c90d4f52-b07f-4569-aad5-794e12e169cf',date:'2027-03-20',source:'https://radsport-events.de/events/26779',locationOf:'b0f9c209-53c0-4534-94c8-7ea00fe68a0a',detach:[R(27833,'2027-04-10'),R(27835,'2027-05-29'),R(27834,'2027-05-22'),R(27831,'2027-03-13'),R(26786,'2027-04-24'),R(27836,'2027-06-12')]},
 {id:'351ed489-431e-4757-9ef5-69b021276b45',date:'2027-09-11',source:'https://radsport-events.de/events/27867',detach:[R(27866,'2027-06-11')]},
 {id:'25fc034b-b1a7-4de7-868e-2a93ede53174',date:'2027-06-29',source:'https://radsport-events.de/events/27810',detach:[R(5157,'2027-06-29'),R(27811,'2027-04-03')]},
 {id:'a1303aae-fc63-44b9-a1c9-e192024dc1a7',date:'2027-08-15',source:'https://www.cyclingaustria.at/',detach:[OERV]},
 {id:'2295516a-61df-4243-883a-6b9028370694',date:'2027-05-30',mergeInto:'53bf02fc-b24b-443e-bab3-40b8eed90036',source:'https://rideandrest.net/manifestazione/bike-festival-riva-del-garda-2027/',detach:['rideandrest-bike-festival-riva-del-garda-2027-2027-05-30']},
 {id:'979a2aa5-72f0-451e-b538-c53b75ef4ed2',date:'2026-10-30',end:'2026-11-03',source:'https://rideandrest.net/manifestazione/molise-trail-2026/',detach:['rideandrest-molise-trail-2026-2026-11-30']},
 {id:'fa9cbb9a-f2ef-42e3-9e2a-5aebb3034d4f',date:'2027-06-19',source:'https://www.gravallo.bike/',lock:['start_date','end_date'],detach:[]},
];
const q=s=>`'${String(s).replaceAll("'","''")}'`;
const ids=plan.map(p=>q(p.id)+'::uuid').join(',');
const before=JSON.parse(run(`select json_build_object('events',(select json_agg(json_build_object('id',id,'name',name,'start_date',start_date,'end_date',end_date,'fingerprint',fingerprint,'website_url',website_url,'location_id',location_id,'status',status,'visibility',visibility)) from public.events where id in (${ids})),'sources',(select json_agg(s) from public.event_sources s where event_id in (${ids})),'overrides',(select json_agg(o) from public.event_overrides o where event_id in (${ids})))`));
const file=path.join(__dirname,`split-journal-${target}.json`);
if(!dry&&fs.existsSync(file))throw Error(`${file} exists: this has already run`);
const missing=plan.filter(p=>!before.events.some(e=>e.id===p.id));if(missing.length)throw Error(`Missing ${missing.map(m=>m.id)}`);
const sql=['begin;'];
for(const p of plan){
 const old=before.events.find(e=>e.id===p.id);
 const end=p.end??(old.end_date?p.date:null);
 const fp=old.fingerprint?`${p.date}${old.fingerprint.slice(10)}`:null;
 if(p.moveOut)sql.push(`update public.event_sources set event_id=${q(p.moveOut.to)}::uuid where event_id=${q(p.id)}::uuid and external_id=${q(p.moveOut.external)};`);
 if(p.detach.length)sql.push(`delete from public.event_sources where event_id=${q(p.id)}::uuid and external_id in (${p.detach.map(q).join(',')});`);
 if(p.mergeInto){sql.push(`select public.app_merge_events(${q(p.mergeInto)}::uuid,${q(p.id)}::uuid);`);continue;}
 if(old.start_date!==p.date||(old.end_date??null)!==end){
  sql.push(`update public.events set start_date=${q(p.date)}::date,end_date=${end?q(end)+'::date':'null'},fingerprint=${fp?q(fp):'fingerprint'} where id=${q(p.id)}::uuid;`);
  sql.push(`insert into public.event_facts(event_id,field,value,previous,source_url,method,version,status) values (${q(p.id)}::uuid,'start_date',${q(JSON.stringify(p.date))}::jsonb,${q(JSON.stringify(old.start_date))}::jsonb,${q(p.source)},'manual_split','split-2026-11-05','active');`);
 }
 if(p.website&&old.website_url!==p.website)sql.push(`update public.events set website_url=${q(p.website)} where id=${q(p.id)}::uuid;`);
 if(p.locationOf)sql.push(`update public.events set location_id=(select location_id from public.events where id=${q(p.locationOf)}::uuid) where id=${q(p.id)}::uuid;`);
 if(p.lock)sql.push(`insert into public.event_overrides(event_id,fields,locked_fields,updated_by) values (${q(p.id)}::uuid,'{}'::jsonb,array[${p.lock.map(q).join(',')}],'split-2026-11-05') on conflict (event_id) do update set locked_fields=(select array(select distinct unnest(public.event_overrides.locked_fields||excluded.locked_fields))),updated_by=excluded.updated_by;`);
}
sql.push(dry?'rollback;':'commit;');
if(!dry)fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),target,plan,before},null,1));
const tmp=path.join(require('node:os').tmpdir(),`split-${process.pid}.sql`);fs.writeFileSync(tmp,sql.join('\n'));
try{cp.execFileSync(BIN,target==='local'?['-h','127.0.0.1','-p','54329','-U','postgres','-d','letsrace','-qAt','-v','ON_ERROR_STOP=1','-f',tmp]:['-qAt','-v','ON_ERROR_STOP=1','-f',tmp],{encoding:'utf8',env:target==='local'?{...process.env,NODE_OPTIONS:''}:{...serverEnvironment(),NODE_OPTIONS:''}});}
catch(e){if(!dry&&fs.existsSync(file))fs.unlinkSync(file);throw Error(String(e.stderr||e.message).slice(0,500));}
finally{fs.unlinkSync(tmp);}
console.log(JSON.stringify({target,dry,statements:sql.length-2,sourcesBefore:before.sources.length}));
