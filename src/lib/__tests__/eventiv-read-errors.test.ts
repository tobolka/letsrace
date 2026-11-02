import { afterEach, expect, it, vi } from "vitest";
import { parseEventiv } from "@/lib/watcher/extractors/eventiv";
afterEach(() => vi.unstubAllGlobals());
it("reports blocked API access instead of an empty successful calendar", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"detail":"Not authenticated"}', { status: 401 })));
  await expect(parseEventiv("https://eventivsport.com/map")).rejects.toThrow("eventiv_api_http_401");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects a successful response that has lost its GeoJSON contract", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"detail":"Sign in"}')));
  await expect(parseEventiv("https://eventivsport.com/map")).rejects.toThrow("eventiv_api_invalid_response");
});
