import { describe, expect, it } from "vitest";
import {
  matchExploreDatePreset,
  parseStoredExploreFilters,
  resolveExploreDatePreset,
  storedExploreFiltersToPatch,
  toStoredExploreFilters,
  urlHasExploreFilterParams,
} from "@/lib/explore-filter-storage";
import { thisWeekendRange } from "@/lib/date-presets";

describe("explore filter storage", () => {
  it("detects filter keys in the URL and ignores map/event-only links", () => {
    expect(urlHasExploreFilterParams("")).toBe(false);
    expect(urlHasExploreFilterParams("?e=some-race")).toBe(false);
    expect(urlHasExploreFilterParams("?west=1&east=2")).toBe(false);
    expect(urlHasExploreFilterParams("?disciplines=mtb")).toBe(true);
    expect(urlHasExploreFilterParams("?sort=distance")).toBe(true);
    expect(urlHasExploreFilterParams("dateFrom=2026-09-19")).toBe(true);
  });

  it("matches named date presets and re-resolves them later", () => {
    const weekend = thisWeekendRange(new Date("2026-09-17T12:00:00"));
    expect(matchExploreDatePreset(weekend.from, weekend.to, new Date("2026-09-17T12:00:00"))).toBe(
      "thisWeekend",
    );
    expect(matchExploreDatePreset("2026-01-01", "2026-01-02")).toBe("custom");
    expect(matchExploreDatePreset("", "")).toBe("any");

    const nextWeek = resolveExploreDatePreset("thisWeekend", weekend.from, weekend.to, new Date("2026-09-24T12:00:00"));
    expect(nextWeek).toEqual(thisWeekendRange(new Date("2026-09-24T12:00:00")));
  });

  it("round-trips stored prefs including distance sort", () => {
    const stored = toStoredExploreFilters({
      q: "",
      categories: [],
      disciplines: ["mtb"],
      levels: ["hobby"],
      series: "",
      country: ["CZ", "SK"],
      sort: "distance",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    expect(stored.datePreset).toBe("custom");
    expect(stored.sort).toBe("distance");

    const raw = JSON.stringify(stored);
    const parsed = parseStoredExploreFilters(raw);
    expect(parsed).toEqual(stored);

    const patch = storedExploreFiltersToPatch(parsed!, new Date("2025-12-01T12:00:00"));
    expect(patch.disciplines).toEqual(["mtb"]);
    expect(patch.country).toEqual(["CZ", "SK"]);
    expect(patch.sort).toBe("distance");
    expect(patch.dateFrom).toBe("2026-01-01");
  });

  it("opens a saved range that has ended from today instead", () => {
    const now = new Date("2026-11-18T12:00:00");
    expect(resolveExploreDatePreset("custom", "2026-11-01", "2026-11-02", now)).toEqual({ from: "2026-11-18", to: "" });
    expect(resolveExploreDatePreset("custom", "2026-11-22", "2026-11-23", now)).toEqual({ from: "2026-11-22", to: "2026-11-23" });
  });

  it("reads a single country saved before the filter took several", () => {
    const parsed = parseStoredExploreFilters(
      JSON.stringify({ v: 1, country: "AT", datePreset: "any", categories: [], disciplines: [], levels: [] }),
    );
    expect(parsed?.country).toEqual(["AT"]);
  });

  it("rejects garbage storage payloads", () => {
    expect(parseStoredExploreFilters(null)).toBeNull();
    expect(parseStoredExploreFilters("{")).toBeNull();
    expect(parseStoredExploreFilters(JSON.stringify({ v: 2 }))).toBeNull();
  });
});

describe("narrow date window", () => {
  it("is a window with an end or one that starts later, not everything from today", async () => {
    const { isNarrowDateWindow } = await import("@/lib/date-presets");
    const now = new Date("2026-11-18T12:00:00");
    expect(isNarrowDateWindow("2026-11-21", "2026-11-22", now)).toBe(true);
    expect(isNarrowDateWindow("2026-11-18", "", now)).toBe(false);
    expect(isNarrowDateWindow("", "", now)).toBe(false);
    expect(isNarrowDateWindow("2026-12-01", "", now)).toBe(true);
  });
});
