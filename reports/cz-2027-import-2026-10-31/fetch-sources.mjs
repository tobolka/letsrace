import fs from 'node:fs';
import {load} from 'cheerio';
const dir='reports/cz-2027-import-2026-10-31/sources';fs.mkdirSync(dir,{recursive:true});
const urls = [
'https://moraviadivide.eu/md27/','https://moraviadivide.eu/registration/','https://raceacross.cz/racz27-info/','https://raceacross.cz/registration/','https://raceacross.cz/ub30-seven-wineyards/','https://raceacross.cz/ub30-registration/',
'https://spokemaraton.cz/','https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2027/propozice','https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2027/registrace','https://www.lesak-cup.cz/','https://www.lesak-cup.cz/propozice/','https://www.tourdekozovazy.cz/','https://www.tourdefeminin.com/cz/',
'https://oremon.cz/','https://oremon.cz/trasa/','https://oremon.cz/en/home_en/','https://lost-ride.cz/','https://lost-ride.cz/news','https://krakonosuvcyklomaraton.cz/propozice/','https://www.cyklomaratontour.cz/clanky/25-rocnik-decathlon-cyklomaratonu-opet-v-hradci-kralove-734.html',
'https://bike-paradise.cz/','https://emtboc2027.cz/en/programme/','https://mtbo.ceskyorientak.cz/kalendar/','https://www.bike-meandr.cz/brdsky-meandr/','https://www.mtbnmnm.com/post/whoop-uci-mountain-bike-world-series-confirms-2027-calendar',
'https://www.czechcyclingfederation.com/','https://www.cyklokros.cz/kalendar','https://www.czechbmx.cz/event/','https://www.zavodynakole.cz/zavody/','https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/','https://kalendar.winspace.cz/kalendar','https://ultracyclinghub.com/explore/in/czechia/','https://www.ediecyclingteam.cz/kopie-z-kalendar-zavodu-2026/'
];
let cursor=0;const results=[];
await Promise.all(Array.from({length:4},async()=>{while(cursor<urls.length){const i=cursor++,url=urls[i];try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});const html=await r.text();const $=load(html);$('script,style,noscript,header,footer,nav').remove();const txt=$('body').text().replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();const key=String(i).padStart(2,'0');fs.writeFileSync(`${dir}/${key}.html`,html);fs.writeFileSync(`${dir}/${key}.txt`,txt);results.push({i,url,status:r.status,final:r.url,key,chars:txt.length,mentions:txt.split('\n').filter(l=>/2027|28\. 8\.|28\.8\.|28\/8|28.08|May 28|May 29/.test(l)).map(l=>l.slice(0,1600)).slice(0,18)});}catch(e){results.push({i,url,error:String(e)});}}}));
results.sort((a,b)=>a.i-b.i);fs.writeFileSync(`${dir}/index.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
