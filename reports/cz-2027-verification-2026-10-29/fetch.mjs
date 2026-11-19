import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
const dir='reports/cz-2027-verification-2026-10-29/sources';
const urls=JSON.parse(process.argv[2]);
await Promise.all(urls.map(async([key,url])=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});const html=await r.text();const $=load(html);$('script,style,nav,footer,header').remove();const txt=$('body').text().replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n');const links=$('a[href]').map((_,e)=>({text:$(e).text().trim(),href:new URL($(e).attr('href'),r.url).href})).get();await fs.writeFile(`${dir}/${key}.html`,html);await fs.writeFile(`${dir}/${key}.txt`,txt);await fs.writeFile(`${dir}/${key}.json`,JSON.stringify({url,finalUrl:r.url,status:r.status,fetchedAt:new Date().toISOString(),hash:createHash('sha256').update(html).digest('hex'),links},null,2));console.log(JSON.stringify({key,url,status:r.status,text:txt.slice(0,Number(process.env.PREVIEW||12000)),links:links.filter(x=>/2027|propoz|registr|pravid|rules|programme|přihl|kalend|trasa|rozpis/i.test(x.text+' '+x.href)).slice(0,45)}));}catch(e){console.log({key,url,error:String(e)})}}));
