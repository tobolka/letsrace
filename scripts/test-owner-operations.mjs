import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '../tmp/pipeline-db-test/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table watched_urls(id serial,status text,last_extract_status text,last_error text,next_poll_at timestamptz default now());grant usage on schema public to service_role;grant select,insert,update on watched_urls to service_role;grant usage on sequence watched_urls_id_seq to service_role;`);
 const file=(await readdir('supabase/migrations')).find(file=>file.endsWith('_owner_operations_overview.sql'));assert(file);await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(`set role service_role;insert into watched_urls(status,last_extract_status,last_error) values('active','error','HTTP 500'),('active','needs_review','unsupported_or_empty_source'),('active','error','pdf_has_no_text: OCR required'),('active','needs_review','identity_review_required: multiple matches'),('active','needs_review','Shared LLM budget: cap'),('active','off_season','old historical error'),('active','needs_review',null),('paused','error','HTTP 500');`);
 const counts=(await db.query('select pipeline_source_counts() as value')).rows[0].value;
 assert.deepEqual(counts,{sources:7,due:7,overdue:0,broken:1,unreadable:2,deferred:1,review:2});
 await db.exec(`insert into pipeline_owner_decisions(key,kind,question,reason,recommendation,default_action,options) values('test','manual_lock','Change the locked date?','Organizer announced a different day','Keep until reviewed','Keep existing lock','[{"value":"keep","label":"Keep"},{"value":"accept","label":"Accept"}]');`);
 const at=(await db.query('select updated_at::text from pipeline_owner_decisions')).rows[0].updated_at;
 const answer=async(value,stamp=at)=>(await db.query('select pipeline_answer_owner($1,$2,$3) as ok',['test',stamp,value])).rows[0].ok;
 assert.equal(await answer('anything-else'),false);assert.equal(await answer('accept','2000-01-01T00:00:00Z'),false);assert.equal(await answer('keep'),true);assert.equal(await answer('accept'),false);
 assert.equal((await db.query('select answer from pipeline_owner_decisions')).rows[0].answer,'keep');
 for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(answer('accept'),/permission denied/);await assert.rejects(db.query('select * from pipeline_owner_decisions'),/permission denied/);await assert.rejects(db.query('select pipeline_source_counts()'),/permission denied/);}
 console.log('PASS: shared source classification, active-only counts, explicit owner choices, stale/repeated answer rejection and private access');
}finally{await db.close();}
