import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events", () => ({
  listSitemapEvents: async () => [{ slug: "test-race", startDate: "2026-11-01", updatedAt: "2026-10-10T12:00:00Z" }],
  listSitemapSeries: async () => [
    { slug: "test-series", updatedAt: "2026-10-09T12:00:00Z" },
    { slug: "undated-series", updatedAt: null },
  ],
}));
vi.mock("@/lib/discipline-hubs", () => ({
  listQualifyingHubs: async () => [{ countryCode: "CZ", discipline: "mtb", races: 10 }],
}));
vi.mock("@/lib/race-collection-data", () => ({ listCollectionSummaries: async () => [] }));

import sitemap from "@/app/sitemap";

afterEach(() => vi.useRealTimers());

describe("sitemap cache stability", () => {
  it("keeps unchanged catalogue output identical across regenerations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
    const first = await sitemap();
    vi.setSystemTime(new Date("2026-10-12T09:00:00Z"));
    expect(await sitemap()).toEqual(first);
    expect(first.filter((entry) => entry.lastModified?.toISOString() === "2026-10-10T12:00:00.000Z")).toHaveLength(5);
    expect(first.filter((entry) => entry.lastModified?.toISOString() === "2026-10-09T12:00:00.000Z")).toHaveLength(5);
  });
});
