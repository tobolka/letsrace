// Compares the database with manifest.json, then reads the public site. Reads only.
import fs from 'node:fs';
const dir='reports/wishlist-2027-2026-11-04';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,''); }
const M=JSON.parse(fs.readFileSync(`${dir}/manifest.json`));
const api=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const rest=async p=>{const r=await fetch(`${api}/rest/v1/${p}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error(p+' '+r.status);return r.json();};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)||(typeof a==='string'&&typeof b==='string'&&Date.parse(a)===Date.parse(b)&&!isNaN(Date.parse(a)));
const db=[];
for(const m of M){
  const [e]=await rest(`events?id=eq.${m.id}&select=*,overrides:event_overrides(locked_fields,fields),categories:event_categories(name,distance_km,elevation_m,age_min,age_max),sources:event_sources(source_url,kind),series:event_series(series_id,is_primary),location:locations(name,municipality,venue,country_code,lat,lng)`);
  const diffs=[];
  for(const [k,v] of Object.entries(m.patch)) if(!same(e[k],v)) diffs.push({k,got:e[k],want:v});
  if(m.practical&&JSON.stringify(e.practical_details)!==JSON.stringify(e.practical_details)) diffs.push({k:'practical'});
  for(const k of Object.keys(m.practical??{})) if(!e.practical_details?.[k]) diffs.push({k:'practical.'+k,missing:true});
  if(m.categories&&e.categories.length!==m.categories.length) diffs.push({k:'categories',got:e.categories.length,want:m.categories.length});
  for(const l of m.locks) if(!e.overrides?.locked_fields?.includes(l)) diffs.push({k:'lock.'+l});
  for(const s of m.sources) if(!e.sources.some(x=>x.source_url===s.url)) diffs.push({k:'source',url:s.url});
  const facts=await rest(`event_facts?event_id=eq.${m.id}&version=eq.wishlist-2027-v1&select=field`);
  db.push({key:m.key,id:m.id,slug:e.slug,name:e.name,start:e.start_date,status:e.status,visibility:e.visibility,type:e.event_type,registration:e.registration_url,closes:e.registration_closes_at,place:e.location?.municipality,country:e.location?.country_code,lat:e.location?.lat,lng:e.location?.lng,categories:e.categories.length,facts:facts.length,series:e.series,diffs});
}
const site='https://letsrace.cz';
const fetchJson=async u=>{const r=await fetch(site+u);return{status:r.status,body:r.ok?await r.json():null};};
const cat=await fetchJson('/api/events?catalogue=1');
const list=Array.isArray(cat.body)?cat.body:(cat.body?.events??cat.body?.items??[]);
const pub=[];
for(const d of db){
  const pages={};
  for(const loc of ['cs/zavod','en/race']){const r=await fetch(`${site}/${loc}/${d.slug}`);const h=await r.text();pages[loc]={status:r.status,hasName:h.includes(d.name.replaceAll('&','&amp;'))||h.includes(d.name),hasReg:d.registration?h.includes(d.registration):null,hasDesc:null,forumReg:h.includes('forum/register'),rcp:h.includes('rcpurgstall.at/events'),eventregRoot:h.includes('"https://www.eventreg.cz/"')};}
  const row=list.find(e=>e.id===d.id);
  pub.push({key:d.key,slug:d.slug,pages,inCatalogue:Boolean(row),catalogueStatus:row?.status,hasCoords:row?(row.location?.lat??row.lat)!=null:null});
}
const queries={gravel_AT:'/api/events?country=AT&disciplines=gravel&dateFrom=2027-09-01&dateTo=2027-09-30',gravel_DE:'/api/events?country=DE&disciplines=gravel&dateFrom=2027-04-01&dateTo=2027-04-30',gravel_PL:'/api/events?country=PL&disciplines=gravel&dateFrom=2027-04-01&dateTo=2027-09-30',mtb_SK_jun:'/api/events?country=SK&disciplines=mtb&dateFrom=2027-06-01&dateTo=2027-06-30',kids_SK:'/api/events?country=SK&categories=kids&dateFrom=2027-06-01&dateTo=2027-06-30',tt_SK:'/api/events?country=SK&disciplines=tt&dateFrom=2027-08-01&dateTo=2027-08-31',hill_SK:'/api/events?country=SK&disciplines=hill_climb&dateFrom=2027-08-01&dateTo=2027-08-31',u11_AT:'/api/events?country=AT&categories=u11&dateFrom=2027-09-01&dateTo=2027-09-30',u15_AT:'/api/events?country=AT&categories=u15&dateFrom=2027-09-01&dateTo=2027-09-30',kids_CZ_may:'/api/events?country=CZ&categories=kids&dateFrom=2027-05-30&dateTo=2027-05-30',gravel_CZ_may:'/api/events?country=CZ&disciplines=gravel&dateFrom=2027-05-30&dateTo=2027-05-30',mtb_CZ_may:'/api/events?country=CZ&disciplines=mtb&dateFrom=2027-05-30&dateTo=2027-05-30'};
const filters={};
for(const [k,u] of Object.entries(queries)){const r=await fetchJson(u);const a=Array.isArray(r.body)?r.body:(r.body?.events??r.body?.items??[]);filters[k]={status:r.status,count:a.length,found:db.filter(d=>a.some(e=>e.id===d.id)).map(d=>d.key)};}
const out={at:new Date().toISOString(),db,cataloguePublicCount:list.length,catalogueStatus:cat.status,public:pub,filters};
fs.writeFileSync(process.argv[2]||`${dir}/verification.json`,JSON.stringify(out,null,1));
console.log(JSON.stringify({dbDiffs:db.filter(d=>d.diffs.length).map(d=>({k:d.key,d:d.diffs})),catalogue:[cat.status,list.length],pub:pub.map(p=>[p.key,p.pages['cs/zavod'].status,p.pages['en/race'].status,p.pages['cs/zavod'].hasName,p.pages['cs/zavod'].hasReg,p.pages['cs/zavod'].forumReg||p.pages['cs/zavod'].rcp,p.inCatalogue,p.hasCoords].join(' ')),filters},null,0));
