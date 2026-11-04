import { afterEach, expect, it, vi } from "vitest";
import { boundedDatabaseFetch, databaseFetch, withDatabaseDeadline, withDatabaseRequestCounts, withDatabaseWorkload } from "@/lib/supabase/request-budget";
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

it("attributes each concurrent workload without leaking headers or counters", async () => {
  const sent = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test");
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://db.test/network") throw new Error("network");
    return new Response(headers.get("x-client-info"), {
      status: url === "https://db.test/failure" ? 503 : 200,
    });
  });
  vi.stubGlobal("fetch", sent);
  const headers = { "x-client-info": "supabase-js-node/test", authorization: "Bearer test" };
  const fetchPublic = databaseFetch("public-web");
  await Promise.all([
    withDatabaseWorkload("publication", () => withDatabaseRequestCounts(async counts => {
      const response = await fetchPublic(new Request("https://db.test/failure", { headers }));
      expect(await response.text()).toBe("supabase-js-node/test letsrace:publication");
      await expect(fetchPublic("https://db.test/network", { headers })).rejects.toThrow("network");
      expect(counts).toEqual({ attempts: 2, failed: 2 });
    })),
    withDatabaseRequestCounts(async counts => {
      const response = await fetchPublic(new Request("https://db.test/public", { headers }));
      expect(await response.text()).toBe("supabase-js-node/test letsrace:public-web");
      expect(counts).toEqual({ attempts: 1, failed: 0 });
    }),
  ]);
  const ordinary = await boundedDatabaseFetch("https://db.test/ordinary", { headers });
  expect(await ordinary.text()).toBe("supabase-js-node/test");
});
