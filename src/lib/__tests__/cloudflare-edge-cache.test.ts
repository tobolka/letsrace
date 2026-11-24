import { describe, expect, it } from "vitest";
import { cacheable, cacheKey, edgeSeconds } from "@/lib/cloudflare-edge-cache";

describe("cloudflare edge cache guard", () => {
  it("never caches Next.js RSC or router prefetch requests", () => {
    const url = "https://letsrace.cz/cs/zavod/peklo-severu-road-n-2-2027";
    expect(cacheable(new Request(url, { headers: { rsc: "1" } }))).toBe(false);
    expect(cacheable(new Request(url, { headers: { "next-router-prefetch": "1" } }))).toBe(false);
    expect(cacheable(new Request(url, { headers: { "next-router-segment-prefetch": "/_tree" } }))).toBe(false);
    expect(cacheable(new Request(url, { headers: { "next-router-state-tree": "%5B%22%22%5D" } }))).toBe(false);
    expect(cacheable(new Request(url, { headers: { accept: "text/x-component" } }))).toBe(false);
    expect(cacheable(new Request(`${url}?_rsc=abc123`))).toBe(false);
  });

  it("caches normal HTML GET requests for public race pages", () => {
    const req = new Request("https://letsrace.cz/cs/zavod/peklo-severu-road-n-2-2027", {
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    expect(cacheable(req)).toBe(true);
    expect(cacheKey(req, "v1").url).toBe("https://edge-cache.invalid/v1/cs/zavod/peklo-severu-road-n-2-2027");
  });

  it("refuses to store text/x-component responses even when CDN-Cache-Control is public", () => {
    const rscRes = new Response('5:[["children",{"s":"__PAGE__"}]]', {
      status: 200,
      headers: {
        "content-type": "text/x-component",
        "cdn-cache-control": "public, s-maxage=1800",
      },
    });
    expect(edgeSeconds(rscRes)).toBe(0);

    const htmlRes = new Response("<!doctype html>", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cdn-cache-control": "public, s-maxage=3600",
      },
    });
    expect(edgeSeconds(htmlRes)).toBe(1800);
  });
});
