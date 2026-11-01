import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/admin/source-health", () => ({ getSourceHealth: async () => ({ stalled: [] }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from(table: string) {
  const counts: Record<string, number> = { discovered_links: 14, pipeline_candidates: 20, feedback_requests: 2, race_submissions: 3, events: 7 };
  const chain: unknown = new Proxy({}, { get: (_, key) => key === "then" ? (resolve: (value: unknown) => void) => resolve({ count: counts[table], error: state.fail && table === "pipeline_candidates" ? { message: "Review queue unavailable" } : null }) : () => chain });
  return chain;
} }) }));
import { getAdminWorkCounts } from "@/lib/admin/work-counts";
afterEach(() => { state.fail = false; });
it("counts source suggestions and race claims, and both kinds of rider messages", async () => {
  expect(await getAdminWorkCounts()).toMatchObject({ discovery: 34, inbox: 5, unlinked: 7, stalled: 0 });
});
it("does not turn an unavailable review queue into a reassuring zero", async () => {
  state.fail = true;
  await expect(getAdminWorkCounts()).rejects.toThrow("Review queue unavailable");
});
