import { beforeEach, expect, it, vi } from "vitest";
import { completePlanChanges } from "@/lib/pipeline/plan-changes";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc: mocks.rpc }) }));
const before = { name: "Race", startDate: "2027-05-01", endDate: null, status: "scheduled", disciplines: ["xco"], registrationUrl: null };
const task = { key: "plan-change:one", token: "token", payload: { eventId: "event", before, after: { ...before, startDate: "2027-06-01" } } };
beforeEach(() => { mocks.rpc.mockReset().mockImplementation(async name => ({ data: name === "pipeline_claim_tasks" ? [task] : true, error: null })); });
it("completes actual saved before/after changes with the existing fingerprints", async () => {
  expect(await completePlanChanges()).toEqual({ completed: 1, changes: 1, deferred: 0 });
  expect(mocks.rpc).toHaveBeenCalledWith("pipeline_finish_plan_changes", { p_key: task.key, p_token: task.token, p_payload: task.payload, p_changes: [{ kind: "date", fingerprint: "date:2027-05-01:2027-06-01", payload: { from: "2027-05-01", to: "2027-06-01" } }] });
});
it("refused completion never counts as a completed notice", async () => {
  mocks.rpc.mockImplementation(async name => ({ data: name === "pipeline_claim_tasks" ? [task] : false, error: null }));
  expect(await completePlanChanges()).toEqual({ completed: 0, changes: 0, deferred: 1 });
});
it("keeps a failed notice retryable instead of treating the changed race as handled", async () => {
  mocks.rpc.mockImplementation(async name => name === "pipeline_finish_plan_changes" ? { data: null, error: { message: "storage failure" } } : { data: name === "pipeline_claim_tasks" ? [task] : true, error: null });
  expect(await completePlanChanges()).toEqual({ completed: 0, changes: 0, deferred: 1 });
  expect(mocks.rpc).toHaveBeenCalledWith("pipeline_retry_task", expect.objectContaining({ p_key: task.key, p_token: task.token, p_delay_seconds: 3600 }));
});
it("preserves non-notifiable changes without inventing rider alerts", async () => {
  const renamed = { ...task, payload: { ...task.payload, after: { ...before, name: "New name" } } };
  mocks.rpc.mockImplementation(async name => ({ data: name === "pipeline_claim_tasks" ? [renamed] : true, error: null }));
  expect(await completePlanChanges()).toEqual({ completed: 1, changes: 0, deferred: 0 });
});
