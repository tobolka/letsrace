import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { WatchOutcome } from "@/lib/watcher/run";
const state = vi.hoisted(() => ({ outcomes: [] as WatchOutcome[], stored: null as Record<string, unknown> | null, alert: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ requireCronSecret: () => true }));
vi.mock("@/lib/watcher/run", () => ({ runDueWatches: async () => state.outcomes }));
vi.mock("@/lib/geocode", () => ({ geocodePendingLocations: async () => ({ updated: 0 }) }));
vi.mock("@/lib/ops/alerts", () => ({ sendOpsAlert: (...args: unknown[]) => state.alert(...args) }));
vi.mock("@/lib/pipeline/operations", () => ({ pipelineJob: async (_key: string, work: () => Promise<Record<string, unknown>>) => { state.stored = await work(); return state.stored; } }));
import { GET } from "@/app/api/cron/watch/route";
import { reportWatchBatch, recordedRunState } from "@/lib/watcher/run-summary";
const base: WatchOutcome = { watchedUrlId: "source", url: "https://club.test", ok: false, eventsUpserted: 0, linksDiscovered: 0 };
afterEach(() => { vi.restoreAllMocks(); state.alert.mockReset(); state.outcomes = []; state.stored = null; });
async function run() { return (await GET(new NextRequest("https://letsrace.test/api/cron/watch"), undefined)).json(); }
it("stores and returns the same reader limitations and deferrals as the Mac log, without a failure alert", async () => {
  state.outcomes = [
    { ...base, error: "unsupported_or_empty_source" },
    { ...base, error: "dynamic_render_unavailable" },
    { ...base, error: "Shared LLM budget: daily cap" },
    { ...base, ok: true, eventsUpserted: 5, eventsCreated: 2, eventsUpdated: 3 },
  ];
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  reportWatchBatch(state.outcomes);
  const local = JSON.parse(log.mock.calls.find(call => call[0] === "pipeline_batch")![1] as string);
  const result = await run();
  expect(result).toMatchObject(local);
  expect(state.stored).toEqual(result);
  expect(result).toMatchObject({ ok: true, status: "deferred", count: 4, failed: 0, unreadable: 2, deferred: 1, created: 2, updated: 3 });
  expect(state.alert).not.toHaveBeenCalled();
});
it("retains real write failures even when the reader reports a limitation or an incorrect success flag", async () => {
  state.outcomes = [
    { ...base, error: "HTTP 500" },
    { ...base, error: "unsupported_or_empty_source", eventsFailed: 1 },
    { ...base, ok: true, eventsFailed: 1 },
    { ...base, ok: true },
  ];
  expect(await run()).toMatchObject({ ok: false, status: "attention", failed: 3, unreadable: 0, deferred: 0 });
  expect(state.alert).toHaveBeenCalledOnce();
  expect(state.stored?.status).toBe("attention");
});
it("makes an empty run explicit without inventing progress", async () => {
  expect(await run()).toMatchObject({ ok: true, status: "ok", count: 0, reads: 0, created: 0, updated: 0, failed: 0, unreadable: 0, deferred: 0 });
  expect(state.alert).not.toHaveBeenCalled();
});
it('uses the same distinction for historical service reports, without calling unfinished work successful',()=>{
 const run={ok:false,error:'unsupported_or_empty_source',finished_at:'2026-11-02T10:00:00Z'};
 expect(recordedRunState(run)).toBe('unreadable');
 expect(recordedRunState({...run,error:'Shared LLM budget: daily cap'})).toBe('deferred');
 expect(recordedRunState({...run,error:'HTTP 500'})).toBe('failed');
 expect(recordedRunState({...run,ok:null,finished_at:null})).toBe('running');
 expect(recordedRunState({...run,ok:null})).toBe('unknown');
});
