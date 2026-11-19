import fs from 'node:fs';import assert from 'node:assert/strict';
const dir='reports/cz-2027-import-2026-10-31',actions=JSON.parse(fs.readFileSync(`${dir}/actions.json`));
const url='https://letsrace.cz/api/events?country=CZ&dateFrom=2027-01-01&dateTo=2027-12-31';
const r=await fetch(url);assert.equal(r.status,200);const feed=await r.json();fs.writeFileSync(`${dir}/public-calendar.json`,JSON.stringify(feed,null,2));
const results=[];let cursor=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<actions.length){const a=actions[cursor++];const shouldList=a.status==='scheduled'&&a.event_type!=='ride';const found=feed.find(e=>e.id===a.id);const link=`https://letsrace.cz/cs/zavod/${a.slug}`;const p=await fetch(link);const html=await p.text();results.push({id:a.id,name:a.name,url:link,status:p.status,inCalendar:Boolean(found),expectedInCalendar:shouldList,titlePresent:html.includes(a.name.replaceAll('&','&amp;'))||html.includes(a.name),finalUrl:p.url});}}));
fs.writeFileSync(`${dir}/public-checks.json`,JSON.stringify(results,null,2));
const failures=results.filter(x=>x.inCalendar!==x.expectedInCalendar|| (x.expectedInCalendar&&x.status!==200));console.log(JSON.stringify({calendarCount:feed.length,checked:results.length,failures}));
if(failures.length)process.exitCode=1;
