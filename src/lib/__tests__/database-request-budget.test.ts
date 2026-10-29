import { afterEach, expect, it, vi } from "vitest";
import { boundedDatabaseFetch, withDatabaseDeadline } from "@/lib/supabase/request-budget";
afterEach(() => vi.unstubAllGlobals());
it("aborts in-flight database work at the shared deadline and does not send work after it", async () => {
  const sent = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  }));
  vi.stubGlobal("fetch", sent);
  await expect(withDatabaseDeadline(Date.now() + 20, () => boundedDatabaseFetch("https://db.test"))).rejects.toThrow();
  await expect(withDatabaseDeadline(Date.now() - 1, () => boundedDatabaseFetch("https://db.test"))).rejects.toThrow("write_time_budget_exhausted");
  expect(sent).toHaveBeenCalledOnce();
});
it("honours caller cancellation as well as the deadline", async () => {
  const controller = new AbortController(); controller.abort();
  vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => {
    init?.signal?.throwIfAborted(); return Promise.resolve(new Response("ok"));
  }));
  await expect(withDatabaseDeadline(Date.now() + 1000, async () => boundedDatabaseFetch("https://db.test", { signal: controller.signal }))).rejects.toThrow();
});
