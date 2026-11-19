import fs from 'node:fs';import crypto from 'node:crypto';
const dir='reports/winspace-2026-10-31',list=JSON.parse(fs.readFileSync(`${dir}/comparison.json`)),db=JSON.parse(fs.readFileSync(`${dir}/before.json`));const map={0:'b6830e12-4acb-44e3-9b3c-b3572d3ef9ab',3:'b6c8def4-a9e8-46eb-9fd9-c0319f33a3de',5:'2dd74877-a4c4-4caa-bf66-b2d7793296a4',8:'d36322c4-dab4-4bc7-b8af-28af0e57762f',12:'daaa376f-dfc7-47ab-90e0-38cf885cf000',15:'926647e8-124b-4469-b074-12e111d6d7a4',25:'ea1df945-b650-4a95-a5a4-44b52f747006',28:'47bec5f3-1f99-458f-acd1-0a80d4c5308e',36:'8726ee9e-6d1a-430a-9939-2ca3b77d1f0d',42:'8bc06674-c61e-4c03-994a-f9cca966af27',45:'da8a343e-872c-4027-8c87-bca41aa642d0',49:'8e2e11bf-9324-4651-9990-2c1583561c6a'};
Object.assign(map,{58:'c4ba0a71-6c75-47cb-a329-4a5762ae8147',59:'1790a5d0-bb9c-4cbb-bf6c-da66ba021ca0',64:'23b63e35-476a-4418-b635-1351534decff',71:'13f142d9-8d4e-4f17-9a89-0be143032766',74:'abbc373b-3a35-4d82-9902-e29ac39832cf',78:'7ccd648a-d658-4b85-b9de-8320fb9092eb',81:'30b66cc3-d28f-4233-8898-b616275a1249',85:'8a2604ad-3555-492c-bf77-465e916cf2fd',87:'b5b6db22-50ca-4ccf-9656-22b04dc22548',89:'a400ecce-5c6e-49ea-bfe2-09a2b0f476c6',90:'28f0310a-7316-4b1d-bd6f-153225beda34'});
const specs={
0:{name:'Slovenský pohár na dráhe — Praha',date:'2026-10-31',end:'2026-11-01',website:'https://www.cyklistikaszc.sk/sk/submenu/kalendar-vysledky',note:'Federation separates official training on 30 October from race on 31 October–1 November.'},
3:{cc:'GR',place:'Loutraki',name:'Gran Fondo Greece',website:'https://kyvernitis.gr/sports-and-events/uci-gran-fondo-greece/'},
5:{cc:'TR',place:'Antalya',name:'Granfondo Antalya',end:'2026-11-08'},
8:{cc:'ES',place:'La Nucia',name:'Granfondo La Nucia',note:'UCI official calendar confirms 7 November, replacing erroneous 18 October.'},
10:{website:'https://www.juniorcycling.cz/',note:'Winspace explicit dated calendar listing; linked ČUS detail returns 404. No copied AI category detail.'},
12:{cc:'BR',place:'Timbó',name:'Granfondo Brazil'},15:{cc:'EC',place:'Salinas',name:'Granfondo Ecuador'},
18:{disciplines:['other'],event_type:'race',note:'Cycle-ball competition; not track racing.'},
25:{cc:'AR',place:'Villa la Angostura',name:'Gran Fondo 7 Lagos',end:'2026-11-22'},
26:{disciplines:['other'],event_type:'race',note:'Cycle-ball competition; not track racing.'},
28:{name:'7. kolo: NoLimited cup v CX (UCI C1)',website:'https://cyclocross-samorin.com/en/',registration:'https://www.cyklistikaszc.sk/sk/submenu/kalendar-vysledky/prihlasenie/i-2216'},
31:{website:'https://www.da-ba.com/'},
35:{disciplines:['other'],event_type:'race',note:'Cycle-ball competition; not track racing.'},
36:{cc:'CO',place:'Medellín',name:'Granfondo Colombia'},
39:{name:'Mikulášský cyklokros — Břeccross',note:'Remove stale 2025 from title; 5 December 2026 is explicit in federation-sourced calendar.'},
40:{website:'https://www.cyklistikaszc.sk/sk/submenu/kalendar-vysledky',event_type:'championship'},41:{website:'https://www.cyklistikaszc.sk/sk/submenu/kalendar-vysledky'},
42:{cc:'GP',place:'Capesterre-Belle-Eau',name:'Granfondo La Guadeloupe',website:'https://ucigranfondoworldseries.com/en/granfondo-la-guadeloupe/'},
45:{cc:'CN',place:'Lingao, Hainan',name:'Gran Fondo Hainan',end:'2026-12-13'},
49:{cc:'AE',place:'Al Ain',name:'AD Ports Group Gran Fondo Abu Dhabi'},
51:{website:'https://coloursofistria.com/en/events/istria-granfondo'},
56:{cc:'HR',place:'Novalja'},
60:{previous:'dcb16814-5151-4de5-9c28-01d1e6901142',website:'https://cykloknezice.cz/bike-maraton/predvyber-cz-bike-maraton-vysocina-2027',disciplines:['mtb','xcm','gravel'],event_type:'race',description:'Závod 29. května 2027 v Kněžicích u Jihlavy s variantami MTB a gravel a dětskými závody. Podrobnosti jsou na webu pořadatele.'},
61:{cc:'SK',place:'Banská Bystrica'},68:{website:'https://www.dolomitensport.at/de/events/dolomitenradrundfahrt.html',disciplines:['road','gran_fondo']},
69:{website:'https://franja.org/maraton/'},79:{event_type:'ride',note:'Organiser calls this a cycling ride; retain ride classification. Only header date for 2027 confirmed; body has old 2026 logistics.'},
91:{cc:'SI',place:'Kranj',previous:'a09b09bb-4102-41c8-9122-438bad5ab09b'},93:{cc:'SK',place:'Rimavská Sobota'},94:{cc:'HR',place:'Poreč'}
};
const excluded={7:'Prize-giving ceremony, not a race.',50:'31 December is a placeholder; series calendar lists cancelled July Žamberk criterium.',82:'Linked organiser describes Triathlon Attack (swim/bike/run), not a standalone cycling time trial; identity needs review.',86:'2027 date only in aggregator; organiser still shows 2026 and says next date to be announced. Review before creating annual edition.'};
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const actions=[],coverage=[];
for(let i=0;i<list.length;i++){let r=list[i],s=specs[i];let e=map[i]?db.find(e=>e.id===map[i]):db.find(e=>e.website_url===r.url);if(!e){let candidates=db.filter(e=>e.start_date===r.date&&norm(e.name)===norm(r.name));e=candidates.find(e=>e.visibility==='public')||candidates[0];}if(!e){const cand=r.candidates.filter(e=>e.days===0&&e.visibility==='public'&&e.score>=.95);if(cand.length===1)e=db.find(e=>e.id===cand[0].id);}if([53,54,55].includes(i))e=db.find(e=>e.id==='258bb5a5-8cc3-4cfb-8726-4211db0fc7a5');if(i===21)e=db.find(e=>e.id==='f9a8bbe8-1e68-4805-9080-203cedde7c75');
if(excluded[i]){coverage.push({index:i,name:r.name,source:r.url,id:e?.id,outcome:'excluded',reason:excluded[i]});continue;}
if(!s&&e?.visibility==='public'){coverage.push({index:i,name:r.name,source:r.url,id:e.id,outcome:'already_public'});continue;}
if(!s&&!e){throw Error('unmapped '+i+' '+r.name)}
s ||= {};let prev=s.previous?db.find(e=>e.id===s.previous):undefined;const cc=s.cc||e?.location?.country_code||prev?.location?.country_code||'CZ';let place=s.place||e?.location?.name||prev?.location?.name;let loc=e?.location||prev?.location;if(s.cc&&loc?.country_code!==s.cc||s.place&&norm(loc?.name||'')!==norm(s.place)){loc=db.map(e=>e.location).find(l=>l?.country_code===cc&&norm(l.name)===norm(place)&&l.lat!=null)||null;}
let website=s.website||r.links.find(x=>/^https?:/.test(x.url))?.url||e?.website_url||null;
if(website&&/\.(pdf|zip)(\?|$)/i.test(website))website=e?.website_url&&!e.website_url.includes('winspace')?e.website_url:null;
const start=s.date||r.date;const patch={name:s.name||e?.name||r.name,start_date:start,end_date:s.end||r.date,website_url:website,visibility:['CZ','SK','PL','DE','AT','CH','IT'].includes(cc)?'public':'hidden',status:'scheduled',season:start.slice(0,4)};
if(s.disciplines){patch.disciplines=s.disciplines;patch.formats=s.disciplines.filter(x=>['xcm','gran_fondo','tt','hill_climb'].includes(x));}if(s.event_type)patch.event_type=s.event_type;if(s.description)patch.description=s.description;if(s.registration)patch.registration_url=s.registration;
if(!e){Object.assign(patch,{disciplines:patch.disciplines||prev?.disciplines||[],formats:patch.formats||prev?.formats||[],age_categories:prev?.age_categories||[],age_confidence:prev?.age_categories?.length?'previous':null,source_kind:'manual',event_type:patch.event_type||prev?.event_type||'race',competition_type:prev?.competition_type||'community',audience:prev?.audience||'mixed',level:prev?.level||'local'});}
if(loc?.id)patch.location_id=loc.id;
if(e){for(const k of e.overrides?.locked_fields||[]){if(k in patch&&JSON.stringify(patch[k])!==JSON.stringify(e[k]))throw Error('Locked conflict '+i+' '+k);}}
let id=e?.id||crypto.randomUUID();actions.push({index:i,id,create:!e,before:e,patch,country:cc,place,location:loc,needsLocation:!loc||loc.country_code!==cc||loc.lat==null,previous:prev||null,source:r.url,official:website,note:s.note||'Manually reviewed explicit calendar date and event identity; organiser link where available.'});coverage.push({index:i,name:r.name,source:r.url,id,outcome:e?'repair_existing':'create'});
}
fs.writeFileSync(`${dir}/actions.json`,JSON.stringify(actions,null,2));fs.writeFileSync(`${dir}/coverage.json`,JSON.stringify(coverage,null,2));console.log(actions.map(x=>({i:x.index,id:x.id,name:x.patch.name,cc:x.country,v:x.patch.visibility,create:x.create,place:x.place,geo:x.needsLocation})));console.log('Actions',actions.length,'coverage',coverage.length);
