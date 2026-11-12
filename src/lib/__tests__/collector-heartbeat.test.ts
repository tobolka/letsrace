import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state=vi.hoisted(()=>({allowed:true,saved:null as Record<string,unknown>|null,rpc:vi.fn()}));
vi.mock('@/lib/cron-auth',()=>({requireCronSecret:()=>state.allowed}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:()=>({rpc:state.rpc,from:(table:string)=>({
 upsert:async(value:Record<string,unknown>)=>{expect(table).toBe('pipeline_workers');state.saved=value;return{error:null};}
})})}));
import { POST } from '@/app/api/ops/pipeline-status/route';
const body={status:'waiting',paused:false,nextRunAt:1793617200000,lastResult:{at:1793610000000,created:2,updated:3,failed:0}};
const send=(input:unknown)=>POST(new NextRequest('https://letsrace.test/api/ops/pipeline-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),undefined);
beforeEach(()=>{
 state.allowed=true;state.saved=null;
 state.rpc.mockReset().mockResolvedValue({data:{jobs:[{key:'server-free'}],health:{reads24h:3},reviewCandidates:4,
  sources:{sources:12,due:7,overdue:2,broken:1,unreadable:2,deferred:3,review:4}},error:null});
});
it('stores only operational counters, without local paths or process information',async()=>{
 const response=await send({...body,root:'/private/root',processes:['private-app'],lastResult:{...body.lastResult,problems:[{url:'https://private.test/'}]}});
 expect(response.status).toBe(200);expect(state.saved).toMatchObject({key:'mac',paused:false,status:'waiting',summary:body.lastResult});
 expect(JSON.stringify(state.saved)).not.toMatch(/private|processes|problems/);expect(Date.parse(String(state.saved?.heartbeat_at))).toBeGreaterThan(Date.now()-10000);
 expect(state.rpc.mock.calls).toEqual([['pipeline_collector_overview',{}]]);
 expect(await response.json()).toMatchObject({jobs:[{key:'server-free'}],health:{reads24h:3},reviewCandidates:4,due:7,attentionSources:10,overdueSources:2});
});
it('does not accept a heartbeat without the existing collector authorization',async()=>{state.allowed=false;expect((await send(body)).status).toBe(401);expect(state.saved).toBeNull();});
it('rejects impossible counters instead of displaying invented progress',async()=>{expect((await send({...body,lastResult:{created:-1}})).status).toBe(400);expect(state.saved).toBeNull();});
