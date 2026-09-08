import { describe, expect, it } from "vitest";
import {
  DEDUP_THRESHOLD,
  formatConflict,
  isGarbagePlace,
  nameSimilarity,
  normalizeUrlForDedup,
  pickBestDuplicate,
  raceFormats,
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

/**
 * "German National Championships - DHI" and "Todtnau Downhill" are the same
 * race on the same day at the same coordinates. They never reached the review
 * queue: `dh` and `downhill` were separate formats, so the pair was thrown out
 * as a format conflict before anything else was looked at.
 */
describe("raceFormats", () => {
  it("reads the names of one format as one format", () => {
    expect(raceFormats("German National Championships - DHI")).toEqual(["dh"]);
    expect(raceFormats("Todtnau Downhill")).toEqual(["dh"]);
    expect(formatConflict("German National Championships - DHI", "Todtnau Downhill")).toBe(false);
  });

  it("still separates formats that really differ", () => {
    expect(formatConflict("Todtnau Downhill", "Todtnau XCO")).toBe(true);
    expect(formatConflict("Bike maraton Drásal", "Cyklokros Kolín")).toBe(true);
  });

  it("does not find a format inside a town", () => {
    // "Sandhausen" and "Nordhausen" both contain "dh".
    expect(raceFormats("Rund um Sandhausen")).toEqual([]);
    expect(formatConflict("Rund um Sandhausen", "Nordhausen Kriterium")).toBe(false);
    // "cyclo" used to match the middle of "cycling".
    expect(raceFormats("Gran Fondo Cycling Tour")).toEqual([]);
  });

  it("says nothing when a title names no format", () => {
    expect(formatConflict("Grand Prix Brno", "Velká cena Brna")).toBe(false);
  });
});

/**
 * "Park Bike" from the federation and "Ostrov — PARKBIKE OSTROV" from the cup
 * are one race at Ostrov, and they sat on the map as two: on bigrams the space
 * between the halves of the name costs enough to fall under every threshold,
 * and the cup's row canonicalises to mostly its series.
 */
describe("one race, two spellings", () => {
  const at = (name: string, seriesName?: string) => ({
    id: name,
    name,
    startDate: "2026-10-03",
    placeText: "Ostrov",
    lat: 50.3059,
    lng: 12.946,
    seriesName: seriesName ?? null,
    disciplines: ["mtb"],
  });

  it("reads a compound and a spaced name as the same name", () => {
    expect(nameSimilarity("Park Bike", "PARKBIKE")).toBe(1);
    expect(nameSimilarity("Bikemaraton Drásal", "Bike maraton Drásal")).toBe(1);
  });

  it("merges the pair the map was showing twice", () => {
    const { score, reasons } = scoreDuplicate(
      at("Park Bike"),
      at("Ostrov - PARKBIKE OSTROV", "Pohár KV kraje HK"),
    );
    expect(reasons).toContain("name_sim_high");
    expect(score).toBeGreaterThanOrEqual(DEDUP_THRESHOLD);
  });

  it("does not merge two different races at one venue on one day", () => {
    expect(
      scoreDuplicate(at("Park Bike"), at("Ostrovský kritérium")).score,
    ).toBeLessThan(DEDUP_THRESHOLD);
  });

  it("leaves a month between two rounds of one cup alone", () => {
    const april = { ...at("Povltavský bikerský pohár - První jarní cross country"), startDate: "2026-04-19" };
    const may = { ...at("Druhé jarní cross country - Povltavský bikerský pohár DA-BA"), startDate: "2026-05-17" };
    expect(scoreDuplicate(april, may).reasons).toEqual(["dates_too_far"]);
  });
});

/**
 * The Austrian federation's calendar gives the organising club and its federal
 * state where a venue should be. Joined together they geocoded to the state
 * capital, so a race sat 80km from itself and the two rows never met.
 */
describe("a province is not a venue", () => {
  it("treats a bare Austrian state as a place we do not know", () => {
    expect(isGarbagePlace("Kärnten")).toBe(true);
    expect(isGarbagePlace("Wien")).toBe(true);
    expect(isGarbagePlace("Niederösterreich")).toBe(true);
  });

  it("still treats a town as a town", () => {
    expect(isGarbagePlace("Ligist")).toBe(false);
    expect(isGarbagePlace("Klagenfurt")).toBe(false);
    expect(isGarbagePlace("Wiener Neustadt")).toBe(false);
  });
});
