import { afterEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...args: unknown[]) => lookup(...args) }));

import { fetchBot } from "@/lib/http/fetch";
import { BOT_UA, catalogUserAgent, needsBrowserUa } from "@/lib/http/user-agent";
import { UnsafeUrlError } from "@/lib/http/safe-url";

afterEach(() => {
  vi.restoreAllMocks();
  lookup.mockReset();
});

function stubFetch() {
  lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
}

describe("catalogUserAgent", () => {
  it("is the bot by default and a browser only for hosts that block the bot", () => {
    expect(catalogUserAgent("https://example.com/x")).toBe(BOT_UA);
    expect(needsBrowserUa("https://www.detskatour.sk/a")).toBe(true);
    expect(catalogUserAgent("https://www.detskatour.sk/a")).toMatch(/^Mozilla\//);
    expect(needsBrowserUa("not a url")).toBe(false);
  });
});

describe("fetchBot", () => {
  it("sends the bot User-Agent and a deadline", async () => {
    const spy = stubFetch();
    await fetchBot("https://example.com/race");
    const init = spy.mock.calls[0]![1]!;
    expect(new Headers(init.headers).get("user-agent")).toBe(BOT_UA);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("lets the caller's headers win", async () => {
    const spy = stubFetch();
    await fetchBot("https://example.com/race", { headers: { "user-agent": "custom", range: "bytes=0-9" } });
    const headers = new Headers(spy.mock.calls[0]![1]!.headers);
    expect(headers.get("user-agent")).toBe("custom");
    expect(headers.get("range")).toBe("bytes=0-9");
  });

  it("refuses an address that resolves into the private network", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(fetchBot("https://evil.example/")).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(spy).not.toHaveBeenCalled();
  });
});
