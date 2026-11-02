import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("shares an in-flight read but refreshes the catalogue after five minutes", async () => {
  vi.resetModules(); vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "first" }])));
  vi.stubGlobal("fetch", fetcher);
  const { loadCatalogue } = await import("@/lib/load-catalogue");
  const first = loadCatalogue();
  expect(loadCatalogue()).toBe(first);
  await first;
  vi.advanceTimersByTime(299_999);
  expect(loadCatalogue()).toBe(first);
  fetcher.mockResolvedValue(new Response(JSON.stringify([{ id: "new" }])));
  vi.advanceTimersByTime(1);
  expect(await loadCatalogue()).toEqual([{ id: "new" }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not keep a failed or malformed read as an empty successful catalogue", async () => {
  vi.resetModules();
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("failure", { status: 503 })).mockResolvedValueOnce(new Response("{}")).mockResolvedValueOnce(new Response("[]"));
  vi.stubGlobal("fetch", fetcher);
  const { loadCatalogue } = await import("@/lib/load-catalogue");
  await expect(loadCatalogue()).rejects.toThrow("503");
  await expect(loadCatalogue()).rejects.toThrow("Invalid catalogue");
  expect(await loadCatalogue()).toEqual([]);
});
