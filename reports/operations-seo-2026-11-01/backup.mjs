import fs from 'node:fs';
import {parse} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
const env=parse(fs.readFileSync('.env.local'));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ids=['a55944aa-c6ac-4428-bfcd-eba0a897582d','3a64d3b6-b9c8-4d82-a29e-1ec3b1df6ce9','93a4f5d5-7043-41e4-b834-069df9fd1105','9f255e7a-a446-4f95-a11b-3226fc4b39a1','1a94a41a-b49e-4941-98aa-8b653ca59ecc','38b83324-c9e0-4603-8fa5-a42b50de7a87'];
const out={at:new Date().toISOString()};
for(const table of ['events','event_sources','event_categories','event_series','event_overrides','event_facts']){
 const {data,error}=await db.from(table).select('*').in(table==='events'?'id':'event_id',ids);if(error)throw error;out[table]=data;
}
for(const table of ['pipeline_candidates','discovered_links']){const {data,error}=await db.from(table).select('*').in('status',table==='pipeline_candidates'?['waiting']:['pending']);if(error)throw error;out[table]=data;}
fs.writeFileSync('reports/operations-seo-2026-11-01/before.json',JSON.stringify(out,null,2));
console.log('Saved non-personal backup,',out.events.length,'events');
