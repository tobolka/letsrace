import fs from 'node:fs';import {parse} from 'dotenv';import {load} from 'cheerio';import {createClient} from '@supabase/supabase-js';
const env=parse(fs.readFileSync('.env.local'));const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const before=JSON.parse(fs.readFileSync('reports/operations-seo-2026-11-01/before.json'));
const after={at:new Date().toISOString()};
for(const t of ['events','event_sources','event_categories','event_series','event_overrides']){const {data,error}=await db.from(t).select('*').in(t==='events'?'id':'event_id',before.events.map(e=>e.id));if(error)throw error;after[t]=data;}
for(const t of ['event_sources','event_categories'])for(const row of before[t]){if(!after[t].some(e=>e.id===row.id))throw Error('Lost '+t+' '+row.id);}
fs.writeFileSync('reports/operations-seo-2026-11-01/after.json',JSON.stringify(after,null,2));
const paths=['/cs','/en','/cs/seznam','/cs/kalendar','/cs/zavody/cz','/cs/zavody/cz/mtb','/cs/zavody/cz/mtb?page=2','/cs/seznam?q=test','/cs/zavod/not-a-real-race-20271101','/cs/zavod/dekom-sudety-tour-medio-fondo-2027','/cs/zavod/l-etape-czech-republic-hilly-stage-2027',...before.events.map(e=>'/cs/zavod/'+e.slug)];
const out=[];
for(const path of paths){const started=Date.now();const r=await fetch('https://letsrace.cz'+path,{redirect:'manual'});const html=await r.text();const $=load(html);const schemas=$('script[type="application/ld+json"]').map((_,e)=>{try{return JSON.parse($(e).text())}catch{return {invalid:true}}}).get();out.push({path,status:r.status,redirect:r.headers.get('location'),ms:Date.now()-started,bytes:Buffer.byteLength(html),title:$('title').text(),canonical:$('link[rel=canonical]').attr('href'),alternates:$('link[rel=alternate][hreflang]').map((_,e)=>({language:$(e).attr('hreflang'),href:$(e).attr('href')})).get(),robots:$('meta[name=robots]').attr('content'),h1:$('h1').text(),raceLinks:$('a[href*="/zavod/"]').length,event:schemas.find(s=>s['@type']==='SportsEvent'),invalidSchema:schemas.some(s=>s.invalid)});}
fs.writeFileSync('reports/operations-seo-2026-11-01/public-audit.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({preservedSources:before.event_sources.length,preservedCategories:before.event_categories.length,pages:out.map(({path,status,redirect,robots,raceLinks})=>({path,status,redirect,robots,raceLinks}))},null,2));
