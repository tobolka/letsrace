import { expect, it } from "vitest";
import { boundedBody } from "@/lib/watcher/http";

it("bounds sources whose streamed body exceeds its declared size", async () => {
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(6));
    controller.enqueue(new Uint8Array(6));
    controller.close();
  } });
  await expect(boundedBody(new Response(stream, { headers: { "content-length": "3" } }), 10)).rejects.toThrow("source_document_too_large");
});

it("preserves small documents without requiring Content-Length", async () => {
  expect(new TextDecoder().decode(await boundedBody(new Response("calendar"), 10))).toBe("calendar");
});
