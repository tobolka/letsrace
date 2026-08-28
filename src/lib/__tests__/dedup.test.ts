import { describe, expect, it } from "vitest";
import {
  DEDUP_THRESHOLD,
  normalizeUrlForDedup,
  pickBestDuplicate,
  scoreDuplicate,
  spanDays,
  urlsOverlap,
} from "@/lib/dedup";
import { fingerprint, fingerprintVariants } from "@/lib/domain";

describe("url identity", () => {
  it("collapses locale prefixes and directory indexes onto one key", () => {
    const key = "example.at/race/kamptal-trophy";
    expect(normalizeUrlForDedup("https://www.example.at/en/race/kamptal-trophy")).toBe(key);
    expect(normalizeUrlForDedup("https://example.at/de/race/kamptal-trophy")).toBe(key);
    expect(normalizeUrlForDedup("https://example.at/race/kamptal-trophy/index.html")).toBe(key);
    expect(urlsOverlap(["https://example.at/en/race/x"], ["https://www.example.at/cs/race/x"])).toBe(
      true,
    );
  });

  it("keeps calendar hubs and bare locale roots unusable as identity", () => {
    expect(normalizeUrlForDedup("https://example.at/en")).toBe("");
    expect(normalizeUrlForDedup("https://kidscup.bike/en/race-calendar")).toBe("");
    expect(normalizeUrlForDedup("https://pekloseveru.cz/en/registration")).toBe("");
    expect(normalizeUrlForDedup("https://www.mtbs.cz/kalendar")).toBe("");
  });

  it("does not fuse different races on one host", () => {
    expect(normalizeUrlForDedup("https://example.at/race/a")).not.toBe(
      normalizeUrlForDedup("https://example.at/race/b"),
    );
  });
});

describe("fingerprint lookup variants", () => {
  const ev = { startDate: "2026-05-10", name: "Bedřichov XCO", lat: 50.8, lng: 15.15 };

  it("covers the exact cell, its neighbours and the coordinate-less variant", () => {
    const variants = fingerprintVariants(ev);
    expect(variants).toContain(fingerprint(ev));
    expect(variants).toContain("2026-05-10:nogps:bedrichov");
    // one cell + 8 neighbours + nogps
    expect(variants).toHaveLength(10);
  });

  it("matches a start line that geocoded into the neighbouring geohash cell", () => {
    // ~1 km apart, but on opposite sides of a geohash-5 border.
    const a = { startDate: "2026-05-10", name: "Bedřichov XCO", lat: 50.8, lng: 15.15 };
    const b = { ...a, lat: 50.8, lng: 15.19 };
    expect(fingerprint(a)).not.toBe(fingerprint(b));
    expect(fingerprintVariants(a)).toContain(fingerprint(b));
  });

  it("falls back to nogps when a source ships no coordinates", () => {
    expect(fingerprintVariants({ startDate: "2026-05-10", name: "Bedřichov XCO" })).toEqual([
      "2026-05-10:nogps:bedrichov",
    ]);
  });
});

describe("multi-day spans", () => {
  it("enumerates every day of a span and caps runaway end dates", () => {
    expect(spanDays({ startDate: "2026-05-08", endDate: "2026-05-10" })).toEqual([
      "2026-05-08",
      "2026-05-09",
      "2026-05-10",
    ]);
    expect(spanDays({ startDate: "2026-05-08" })).toEqual(["2026-05-08"]);
    expect(spanDays({ startDate: "2026-05-08", endDate: "2027-05-10" })).toHaveLength(12);
  });

  it("a three-day listing still matches its final-day mirror", () => {
    const { score, reasons } = scoreDuplicate(
      {
        startDate: "2026-07-10",
        endDate: "2026-07-12",
        name: "Salzkammergut Trophy",
        lat: 47.6,
        lng: 13.6,
        placeText: "Bad Goisern",
      },
      {
        startDate: "2026-07-12",
        name: "Salzkammergut Trophy",
        lat: 47.6,
        lng: 13.6,
        placeText: "Bad Goisern",
      },
    );
    expect(score).toBeGreaterThanOrEqual(DEDUP_THRESHOLD);
    expect(reasons).toEqual(expect.arrayContaining(["same_place", "same_canonical_name"]));
  });
});

describe("pickBestDuplicate", () => {
  const incoming = {
    startDate: "2026-05-10",
    name: "Nova Pacov XCO",
    lat: 49.47,
    lng: 15.0,
    placeText: "Pacov",
  };
  // Same race, but only the neighbouring day — a real match, just a weaker one.
  const weaker = {
    startDate: "2026-05-09",
    name: "Nova Pacov XCO",
    lat: 49.47,
    lng: 15.0,
    placeText: "Pacov",
  };
  const stronger = {
    startDate: "2026-05-10",
    name: "Nova Pacov XCO",
    lat: 49.47,
    lng: 15.0,
    placeText: "Pacov",
  };

  it("takes the highest scorer even when a weaker candidate comes first", () => {
    expect(scoreDuplicate(incoming, weaker).score).toBeGreaterThanOrEqual(DEDUP_THRESHOLD);
    const best = pickBestDuplicate(incoming, [
      { row: "weak", event: weaker },
      { row: "strong", event: stronger },
    ]);
    expect(best?.row).toBe("strong");
    expect(best?.score).toBeGreaterThan(scoreDuplicate(incoming, weaker).score);
  });

  it("returns null when nothing clears the threshold", () => {
    expect(
      pickBestDuplicate(incoming, [
        {
          row: "elsewhere",
          event: {
            startDate: "2026-05-10",
            name: "Bedřichov XCO",
            lat: 50.8,
            lng: 15.15,
            placeText: "Bedřichov",
          },
        },
      ]),
    ).toBeNull();
  });
});
