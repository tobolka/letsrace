import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ authorised: true, task: {} as Record<string, unknown>, tag: vi.fn(), path: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ requireCronSecret: () => state.authorised }));
vi.mock("@/lib/auth/admin", () => ({ isAdminAuthenticated: async () => false }));
vi.mock("next/cache", () => ({ revalidateTag: state.tag, revalidatePath: state.path }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.task, error: null }) }) }) }) }) }));
import { POST } from "@/app/api/ops/publication/route";
const token = "12345678-1234-1234-1234-123456789abc";
const send = (catalogue = false) => POST(new NextRequest("https://letsrace.test/api/ops/publication", { method: "POST", body: JSON.stringify({ key: "public:race", token, revision: "r2", catalogue }) }), undefined);
beforeEach(() => {
  state.authorised = true; state.tag.mockReset(); state.path.mockReset();
  state.task = { kind: "public_refresh", status: "running", token, lease_until: new Date(Date.now() + 60_000).toISOString(), payload: { revision: "r2", slug: "race", expected: { id: "id", name: "Race", start_date: "2027-07-09", status: "scheduled" } } };
});
it("keeps routine publication limited to the changed race", async () => {
  expect((await send()).status).toBe(200);
  expect(state.tag).toHaveBeenCalledWith("public-event:race", { expire: 0 });
  expect(state.tag).not.toHaveBeenCalledWith("public-catalogue", expect.anything());
});
it("refreshes aggregate views only for an explicitly requested operator batch", async () => {
  expect((await send(true)).status).toBe(200);
  expect(state.tag).toHaveBeenCalledWith("public-catalogue", { expire: 0 });
});
it("refuses broad invalidation without authentication and a current claimed revision", async () => {
  state.authorised = false; expect((await send(true)).status).toBe(401);
  state.authorised = true; state.task.status = "done"; expect((await send(true)).status).toBe(409);
  state.task.status = "running"; state.task.lease_until = "2020-01-01"; expect((await send(true)).status).toBe(409);
  state.task.lease_until = new Date(Date.now() + 60_000).toISOString();
  (state.task.payload as { revision: string }).revision = "superseded"; expect((await send(true)).status).toBe(409);
  expect(state.tag).not.toHaveBeenCalled();
});
