import { beforeEach, expect, it, vi } from "vitest";
import type { EventListItem } from "@/lib/events";
const state = vi.hoisted(() => ({ rpc: vi.fn(), rows: [] as EventListItem[] }));
vi.mock("@/lib/events", () => ({ listEvents: async () => state.rows }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc: state.rpc }) }));
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://letsrace.test" }));
import { catalogueFingerprint, publishCatalogueBatch } from "@/lib/pipeline/catalogue-publication";
const row = { id: "a", name: "Race", startDate: "2027-07-09", disciplines: ["mtb"], location: { name: "Deštné", lat: 50, lng: 16 } } as EventListItem;
const task = { key: "catalogue:upcoming", token: "claim", payload: { revision: "r1" } };
beforeEach(() => {
  state.rows = [row];
  process.env.CRON_SECRET = "test-secret";
  state.rpc.mockReset().mockImplementation(async name => name === "pipeline_claim_tasks" ? { data: [task], error: null } : { data: true, error: null });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}")) .mockResolvedValueOnce(new Response(JSON.stringify(state.rows))));
});
it("compares full public content, including places and missing/duplicate races, independently of ordering or reader timestamps", () => {
  const b = { ...row, id: "b" };
  expect(catalogueFingerprint([row, b])).toBe(catalogueFingerprint([{ ...b, lastSeenAt: "later", publicRevision: "technical" }, row]));
  for (const rows of [[], [row, row], [{ ...row, startDate: "2027-07-10" }], [{ ...row, location: { ...row.location!, name: "Wrong place" } }]]) expect(catalogueFingerprint(rows)).not.toBe(catalogueFingerprint([row]));
});
it("verifies the ordinary public URL before completing the exact claimed batch", async () => {
  expect(await publishCatalogueBatch()).toMatchObject({ status: "ok", verified: true, races: 1, eventWrites: 0 });
  expect(fetch).toHaveBeenNthCalledWith(2, "https://letsrace.test/api/events?catalogue=1", expect.objectContaining({ redirect: "error" }));
  expect(state.rpc).toHaveBeenCalledWith("pipeline_finish_task", expect.objectContaining({ p_key: task.key, p_token: task.token, p_payload: task.payload }));
});
it("does no public request when the shared claim budget has no available task", async () => {
  state.rpc.mockResolvedValueOnce({ data: [], error: null });
  expect(await publishCatalogueBatch()).toMatchObject({ status: "waiting", verified: false });
  expect(fetch).not.toHaveBeenCalled();
});
it("keeps mismatched public data pending instead of treating invalidation as success", async () => {
  vi.mocked(fetch).mockReset().mockResolvedValueOnce(new Response("{}")).mockResolvedValueOnce(new Response("[]"));
  expect(await publishCatalogueBatch()).toMatchObject({ status: "deferred", verified: false });
  expect(state.rpc).not.toHaveBeenCalledWith("pipeline_finish_task", expect.anything());
  expect(state.rpc).toHaveBeenCalledWith("pipeline_retry_task", expect.objectContaining({ p_error: expect.stringContaining("does not match") }));
});
it("does not report a concurrent change as the completed batch", async () => {
  state.rpc.mockImplementation(async name => name === "pipeline_claim_tasks" ? { data: [task], error: null } : { data: false, error: null });
  expect(await publishCatalogueBatch()).toMatchObject({ status: "superseded", verified: false });
});
