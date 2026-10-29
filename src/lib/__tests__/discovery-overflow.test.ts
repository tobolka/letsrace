import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ writes: [] as unknown[], fail: false, read: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: () => ({
  select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }),
  upsert: async (row: unknown) => { mocks.writes.push(row); return { error: mocks.fail ? { message: "DB unavailable" } : null }; },
}) }) }));
vi.mock("@/lib/watcher/http", () => ({ fetchPage: mocks.read }));
import { runExplore } from "@/lib/watcher/explore";

afterEach(() => { mocks.writes.length = 0; mocks.fail = false; vi.resetAllMocks(); vi.unstubAllGlobals(); });
function search() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("crt.sh") ? new Response("[]") : new Response(
    '<a class="result__a" href="https://clubrace.cz/event-a">Race A</a><a class="result__a" href="https://clubrace.cz/event-b">Race B</a>',
  )));
  mocks.read.mockResolvedValue({ status: 200, html: "<html><title>Club page</title><body>" + "Some text ".repeat(30) + "</body></html>" });
}

it("persists overflow and low-score leads before the limited fetch phase", async () => {
  search();
  const result = await runExplore({ maxFetch: 1 });
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(result.queued).toBe(2);
  expect(mocks.writes).toEqual([
    expect.objectContaining({ url: "https://clubrace.cz/event-a", status: "pending", hint_kind: "explore_unread" }),
    expect.objectContaining({ url: "https://clubrace.cz/event-b", status: "pending", hint_kind: "explore_unread" }),
  ]);
});

it("surfaces a failed durable enqueue before proceeding with reads", async () => {
  search(); mocks.fail = true;
  await expect(runExplore({ maxFetch: 1 })).rejects.toThrow("Could not persist discovery lead");
  expect(mocks.read).not.toHaveBeenCalled();
});
