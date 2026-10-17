import { afterEach, expect, it, vi } from "vitest";
import { readDocument } from "@/lib/catalog/regulation-ages";
afterEach(() => vi.unstubAllGlobals());
it("keeps the default size limit but allows an explicitly bounded larger official document", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("official rules", { headers: { "content-type": "text/plain", "content-length": "10821566" } })));
  expect(await readDocument("https://example.com/rules")).toBeNull();
  expect((await readDocument("https://example.com/rules", { maxBytes: 16 * 1024 * 1024 }))?.text).toBe("official rules");
});
it("cancels oversized streamed content without needing a Content-Length header", async () => {
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(128)); }, cancel,
  }), { headers: { "content-type": "text/plain" } })));
  expect(await readDocument("https://example.com/rules", { maxBytes: 64 })).toBeNull();
  expect(cancel).toHaveBeenCalledOnce();
});
it("caps an arbitrary requested limit at 16 MiB", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("rules", { headers: { "content-length": String(17 * 1024 * 1024) } })));
  expect(await readDocument("https://example.com/rules", { maxBytes: 1e9 })).toBeNull();
});
