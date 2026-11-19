import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const dir='reports/cz-2027-import-2026-10-31';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').flatMap(l=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);return m?[[m[1],m[2].replace(/^["']|["']$/g,'')]]:[]}));
const s=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const actions=JSON.parse(fs.readFileSync(`${dir}/actions.json`));
const {data,error}=await s.from('events').select('*,location:locations(*),sources:event_sources(*),overrides:event_overrides(*),categories:event_categories(*)').in('id',actions.map(a=>a.id));
if(error)throw error;assert.equal(data.length,38);
for(const a of actions){const r=data.find(e=>e.id===a.id);assert.equal(r.start_date,a.start_date,a.name);assert.equal(r.visibility,a.visibility,a.name);assert.equal(r.status,a.status,a.name);assert.ok(r.overrides.locked_fields.includes('start_date'));assert.ok(r.sources.some(x=>x.source_url===a.source));if(r.status!=='tbc'){assert.ok(r.location.lat!=null&&r.location.lng!=null,a.name);assert.equal(r.location.country_code,'CZ');}if(r.name.includes('MTBO')){assert.ok(r.formats.includes('mtbo'));assert.ok(!r.disciplines.includes('xco'));}}
const merged=await s.from('events').select('merged_into_id,visibility').eq('id','3f3564dc-e017-4348-b15c-d72c6f8c2585').single();assert.equal(merged.data.merged_into_id,'062802f7-278a-4c36-86ec-03787bf79c3d');assert.equal(merged.data.visibility,'hidden');
fs.writeFileSync(`${dir}/after.json`,JSON.stringify(data,null,2));
console.log(JSON.stringify({checked:data.length,publicRaces:data.filter(e=>e.visibility==='public'&&e.status==='scheduled'&&e.event_type!=='ride').length,preservedRides:data.filter(e=>e.event_type==='ride').length,tbc:data.filter(e=>e.status==='tbc').length,mergedDuplicates:1}));
