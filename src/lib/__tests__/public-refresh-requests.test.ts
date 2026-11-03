import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc: state.rpc }) }));
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://letsrace.test" }));
import { requestPublicRefreshes } from "@/lib/pipeline/public-refresh-requests";
const task = { key: "publication:expire", token: "claim", payload: { revision: "r1" } };
beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  state.rpc.mockReset().mockImplementation(async name => ({ error: null, data: name === "pipeline_claim_tasks" ? [task] : name === "pipeline_expiration_candidates" ? [] : name === "pipeline_record_expirations" ? 1 : true }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{key:"public:race",revision:"r1"}],verified:false }))));
});
it("records requests only after a successful response and leaves HTML verification independent", async () => {
  expect(await requestPublicRefreshes()).toEqual({status:"requested",requested:1,verified:false});
  expect(state.rpc).toHaveBeenCalledWith("pipeline_record_expirations", {p_token:"claim",p_items:[{key:"public:race",revision:"r1"}]});
  expect(state.rpc).toHaveBeenCalledWith("pipeline_finish_task", expect.objectContaining({p_key:"publication:expire",p_result:expect.objectContaining({verified:false})}));
});
it("does not acknowledge any revision after an HTTP or interrupted-response failure", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("failed", {status:500}));
  expect(await requestPublicRefreshes()).toMatchObject({status:"deferred",verified:false});
  expect(state.rpc).not.toHaveBeenCalledWith("pipeline_record_expirations",expect.anything());
  expect(state.rpc).not.toHaveBeenCalledWith("pipeline_finish_task",expect.anything());
});
it("keeps remaining revisions pending for another bounded batch", async () => {
  state.rpc.mockImplementation(async name => ({error:null,data:name==="pipeline_claim_tasks"?[task]:name==="pipeline_expiration_candidates"?[{key:"another"}]:name==="pipeline_record_expirations"?1:true}));
  expect(await requestPublicRefreshes()).toMatchObject({status:"partial",requested:1,verified:false});
  expect(state.rpc).toHaveBeenCalledWith("pipeline_retry_task",expect.objectContaining({p_delay_seconds:3600}));
});
it("does nothing when the persistent attempt budget cannot grant a claim", async () => {
  state.rpc.mockResolvedValueOnce({data:[],error:null});
  expect(await requestPublicRefreshes()).toMatchObject({status:"waiting",requested:0});
  expect(fetch).not.toHaveBeenCalled();
});
