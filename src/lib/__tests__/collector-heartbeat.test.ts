import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state=vi.hoisted(()=>({allowed:true,saved:null as Record<string,unknown>|null}));
vi.mock('@/lib/cron-auth',()=>({requireCronSecret:()=>state.allowed}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:()=>({rpc:async(name:string)=>({data:name==='pipeline_source_counts'?{sources:0,due:0,overdue:0,broken:0,unreadable:0,deferred:0,review:0}:{},error:null}),from:(table:string)=>{
 const query:unknown=new Proxy({},{get:(_target,key)=>{
  if(key==='then')return(resolve:(value:unknown)=>void)=>resolve({data:[],count:0,error:null});
  if(key==='upsert')return async(value:Record<string,unknown>)=>{expect(table).toBe('pipeline_workers');state.saved=value;return{error:null};};
  return()=>query;
 }});return query;
}})}));
import { POST } from '@/app/api/ops/pipeline-status/route';
const body={status:'waiting',paused:false,nextRunAt:1793617200000,lastResult:{at:1793610000000,created:2,updated:3,failed:0}};
const send=(input:unknown)=>POST(new NextRequest('https://letsrace.test/api/ops/pipeline-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),undefined);
beforeEach(()=>{state.allowed=true;state.saved=null;});
it('stores only operational counters, without local paths or process information',async()=>{
 const response=await send({...body,root:'/private/root',processes:['private-app'],lastResult:{...body.lastResult,problems:[{url:'https://private.test/'}]}});
 expect(response.status).toBe(200);expect(state.saved).toMatchObject({key:'mac',paused:false,status:'waiting',summary:body.lastResult});
 expect(JSON.stringify(state.saved)).not.toMatch(/private|processes|problems/);expect(Date.parse(String(state.saved?.heartbeat_at))).toBeGreaterThan(Date.now()-10000);
});
it('does not accept a heartbeat without the existing collector authorization',async()=>{state.allowed=false;expect((await send(body)).status).toBe(401);expect(state.saved).toBeNull();});
it('rejects impossible counters instead of displaying invented progress',async()=>{expect((await send({...body,lastResult:{created:-1}})).status).toBe(400);expect(state.saved).toBeNull();});
