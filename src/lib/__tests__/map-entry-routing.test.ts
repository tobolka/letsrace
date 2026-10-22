import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function request(path: string, accept = "text/html") {
  return new NextRequest(`https://letsrace.cz${path}`, { headers: { accept } });
}

describe("cached map entry routing", () => {
  it("keeps ordinary visits and filter URLs on the shared home page", () => {
    for (const path of ["/cs", "/en?q=gravel&dateFrom=2026-10-19", "/pl?e="]) {
      expect(proxy(request(path)).headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it("preserves every query value when routing a race link to its dynamic entry", () => {
    const response = proxy(request("/cs?e=author-cup-2026&disciplines=mtb&disciplines=gravel&dateFrom=2026-10-19"));
    const rewritten = new URL(response.headers.get("x-middleware-rewrite")!);
    expect(rewritten.pathname).toBe("/cs/map-entry");
    expect(rewritten.searchParams.get("e")).toBe("author-cup-2026");
    expect(rewritten.searchParams.getAll("disciplines")).toEqual(["mtb", "gravel"]);
    expect(rewritten.searchParams.get("dateFrom")).toBe("2026-10-19");
    expect(response.headers.get("x-locale")).toBe("cs");
  });

  it("keeps Markdown negotiation and localized race addresses intact", () => {
    expect(proxy(request("/cs?e=author-cup-2026", "text/markdown")).headers.get("Content-Type")).toContain("text/markdown");
    expect(new URL(proxy(request("/cs/zavod/author-cup-2026")).headers.get("x-middleware-rewrite")!).pathname).toBe("/cs/e/author-cup-2026");
  });

  it("holds the map shell on the CDN, not race details or accounts", () => {
    expect(proxy(request("/cs")).headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=604800");
    expect(proxy(request("/cs/zavod/author-cup-2026")).headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(proxy(request("/cs/serie/author-cup")).headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(proxy(request("/cs/muj-plan")).headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(proxy(request("/cs?e=author-cup-2026")).headers.get("Vercel-CDN-Cache-Control")).toBeNull();
  });
});
