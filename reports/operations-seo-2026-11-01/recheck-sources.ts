import fs from 'node:fs';import {parse} from 'dotenv';
Object.assign(process.env,parse(fs.readFileSync('.env.local')),{LLM_CALENDARS:'0',PIPELINE_REVIEW_QUEUE:'1',LLM_BUDGET_USD:'0',LLM_DAILY_BUDGET_USD:'0',LLM_MONTHLY_BUDGET_USD:'0'});
async function main(){
 const {createServerSupabase}=await import('../../src/lib/supabase/server');const {watchOne}=await import('../../src/lib/watcher/run');
 const db=createServerSupabase();const {data,error}=await db.from('watched_urls').select('*').in('id',['d970adaa-5206-4d9b-add3-14a576b5d486','dab453d8-639d-4f6e-baba-b48130b7f852']);if(error)throw error;
 const results=[];for(const row of data??[])results.push(await watchOne(row));fs.writeFileSync('reports/operations-seo-2026-11-01/source-recheck.json',JSON.stringify(results,null,2));console.log(results.map(r=>({url:r.url,error:r.error,ok:r.ok})));
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
