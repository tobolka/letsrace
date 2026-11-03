import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withSourceWork } from "@/lib/pipeline/source-work";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc }) }));
const row={id:"source",url:"https://race.test/"};
const result={watchedUrlId:row.id,url:row.url,ok:true,eventsUpserted:1,eventsCreated:1,linksDiscovered:0};
beforeEach(()=>{rpc.mockReset().mockImplementation(async name=>({data:name==='pipeline_claim_source'?[{key:'source:source',token:'claim'}]:true,error:null}));vi.stubEnv('VERCEL','');});
afterEach(()=>vi.unstubAllEnvs());
it('does not read a source another worker owns or a paused source',async()=>{rpc.mockResolvedValue({data:[],error:null});const read=vi.fn();expect((await withSourceWork(row,read)).error).toBe('source_reader_unavailable_or_running');expect(read).not.toHaveBeenCalled();});
it('does not read a stale URL after the source was edited',async()=>{rpc.mockResolvedValueOnce({data:[{key:'source:source',token:'claim',payload:{url:'https://new-source.test/'}}],error:null});const read=vi.fn();expect((await withSourceWork(row,read)).error).toBe('source_changed_before_read');expect(read).not.toHaveBeenCalled();});
it('limits server readers to HTTP and records the actual source result',async()=>{vi.stubEnv('VERCEL','1');await withSourceWork(row,async()=>result);expect(rpc).toHaveBeenNthCalledWith(1,'pipeline_claim_source',{p_source:'source',p_capabilities:['http']});expect(rpc).toHaveBeenLastCalledWith('pipeline_finish_source',expect.objectContaining({p_key:'source:source',p_token:'claim',p_url:row.url,p_result:expect.objectContaining({created:1,ok:true})}));});
it('lets Mac readers claim browser work without starting a second reader',async()=>{await withSourceWork(row,async()=>result);expect(rpc).toHaveBeenNthCalledWith(1,'pipeline_claim_source',{p_source:'source',p_capabilities:['http','browser']});});
it('records a delayed retry after an unexpected interruption',async()=>{await expect(withSourceWork(row,async()=>{throw Error('Interrupted');})).rejects.toThrow('Interrupted');expect(rpc).toHaveBeenLastCalledWith('pipeline_retry_task',expect.objectContaining({p_key:'source:source',p_error:'Interrupted',p_delay_seconds:3600}));});
it('does not invent a successful completion when recording the result fails',async()=>{rpc.mockImplementation(async name=>name==='pipeline_claim_source'?{data:[{key:'source:source',token:'claim'}],error:null}:{data:null,error:{message:'offline'}});await expect(withSourceWork(row,async()=>result)).rejects.toThrow('Recording source result: offline');});
it('reports refused completion as deferred even when the request itself succeeds',async()=>{
  rpc.mockResolvedValueOnce({data:[{key:'source:source',token:'claim'}],error:null}).mockResolvedValueOnce({data:false,error:null});
  const outcome=await withSourceWork(row,async()=>result);
  expect(outcome).toMatchObject({ok:false,strategy:'deferred',error:'source_reader_unavailable_or_running:result_not_accepted',eventsCreated:1});
  expect(rpc).toHaveBeenCalledTimes(2);
});
it('does not claim an interruption was requeued after losing the lease',async()=>{
  rpc.mockResolvedValueOnce({data:[{key:'source:source',token:'claim'}],error:null}).mockResolvedValueOnce({data:false,error:null});
  await expect(withSourceWork(row,async()=>{throw Error('Interrupted');})).rejects.toThrow('retry_not_accepted');
});
it('does not start work without a confirmed lease token',async()=>{
  const read=vi.fn();
  rpc.mockResolvedValue({data:null,error:null});
  await expect(withSourceWork(row,read)).rejects.toThrow('not confirmed');
  rpc.mockResolvedValue({data:[{key:'source:source'}],error:null});
  await expect(withSourceWork(row,read)).rejects.toThrow('no lease token');
  expect(read).not.toHaveBeenCalled();
});
