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

import sitemap, { generateSitemaps } from "@/app/sitemaps/sitemap";
import { GET as sitemapIndex } from "@/app/sitemap.xml/route";

afterEach(() => vi.useRealTimers());

const build = (id: string) => sitemap({ id: Promise.resolve(id) });
const stamped = (entries: Awaited<ReturnType<typeof sitemap>>, iso: string) =>
  entries.filter((entry) => entry.lastModified instanceof Date && entry.lastModified.toISOString() === iso);

describe("sitemap cache stability", () => {
  it("keeps unchanged catalogue output identical across regenerations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
    const hubs = await build("hubs");
    const races = await build("races-cs");
    vi.setSystemTime(new Date("2026-10-12T09:00:00Z"));
    expect(await build("hubs")).toEqual(hubs);
    expect(await build("races-cs")).toEqual(races);
    expect(stamped(hubs, "2026-10-09T12:00:00.000Z")).toHaveLength(5);
    expect(stamped(races, "2026-10-10T12:00:00.000Z")).toHaveLength(1);
  });
});

describe("sitemap split", () => {
  it("lists hubs in every language and races one language per file", async () => {
    expect((await generateSitemaps()).map((s) => s.id)).toEqual(["hubs", "races-en", "races-cs", "races-pl", "races-sk", "races-de"]);
    expect((await build("hubs")).some((entry) => entry.url.includes("test-race"))).toBe(false);
    const cs = await build("races-cs");
    expect(cs.map((entry) => entry.url)).toEqual([expect.stringMatching(/\/cs\/zavod\/test-race$/)]);
    expect(Object.keys(cs[0].alternates?.languages ?? {})).toContain("de");
    expect(await build("unknown")).toEqual([]);
  });

  it("announces the hubs and the Czech and English races in the index", async () => {
    const xml = await sitemapIndex().text();
    expect(xml.match(/<loc>[^<]+<\/loc>/g)?.map((loc) => loc.replace(/.*\/sitemap\/|\.xml.*/g, ""))).toEqual(["hubs", "races-cs", "races-en"]);
  });
});
