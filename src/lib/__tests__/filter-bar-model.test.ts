import { describe, expect, it } from "vitest";
import {
  EXTRA_ORDER,
  groupSeriesByCountry,
  hasExtraValue,
  layoutExtras,
  seriesView,
  type ExtraState,
} from "@/components/explore/filter-bar-model";
import type { SeriesOption } from "@/lib/explore-filters";

const none: ExtraState = { disciplines: [], categories: [], levels: [], country: [], series: "" };
const series: SeriesOption[] = [
  { slug: "cz-a", name: "Czech A", eventCount: 3, countryCode: "CZ" },
  { slug: "cz-b", name: "Czech B", eventCount: 9, countryCode: "cz" },
  { slug: "world", name: "World Cup", eventCount: 5, countryCode: null, shortName: "WC" },
  { slug: "de-a", name: "German A", eventCount: 1, countryCode: "DE" },
];

describe("hasExtraValue", () => {
  it("reads each filter's own field", () => {
    expect(EXTRA_ORDER.some((id) => hasExtraValue(id, none))).toBe(false);
    expect(hasExtraValue("level", { ...none, levels: ["elite"] })).toBe(true);
    expect(hasExtraValue("series", { ...none, series: "x" })).toBe(true);
  });
});

describe("groupSeriesByCountry", () => {
  it("puts international last and sorts each group by size then name", () => {
    const groups = groupSeriesByCountry(series, "cs", "International");
    expect(groups.at(-1)!.label).toBe("International");
    const cz = groups.find((g) => g.key === "CZ")!;
    expect(cz.items.map((s) => s.slug)).toEqual(["cz-b", "cz-a"]);
  });
});

describe("seriesView", () => {
  it("narrows by name, slug or short name and drops empty groups", () => {
    expect(seriesView(series, [], "cs", "Int", "wc").filteredGroups.flatMap((g) => g.items.map((s) => s.slug))).toEqual(["world"]);
    expect(seriesView(series, [], "cs", "Int", "zzz").filteredGroups).toEqual([]);
  });

  it("shows country headers only when more than one country is in play", () => {
    expect(seriesView(series, [], "cs", "Int", "").showHeaders).toBe(true);
    expect(seriesView(series, ["CZ"], "cs", "Int", "").showHeaders).toBe(false);
  });
});

describe("layoutExtras", () => {
  const base = { hasMenuExtra: false, hasSeries: true, hasCountries: true };

  it("pins only the active filters on desktop and offers the rest in the menu", () => {
    const r = layoutExtras({ ...base, pinAll: false, state: { ...none, levels: ["elite"] } });
    expect(r.shown).toEqual(["level"]);
    expect(r.menu).toEqual(["discipline", "category", "country", "series"]);
  });

  it("hides series and country from the menu when there is nothing to pick", () => {
    const r = layoutExtras({ ...base, hasSeries: false, hasCountries: false, pinAll: false, state: none });
    expect(r.menu).toEqual(["discipline", "category", "level"]);
  });

  it("pins everything on a phone and leaves the menu empty", () => {
    const r = layoutExtras({ ...base, pinAll: true, state: none });
    expect(r.shown).toEqual(EXTRA_ORDER);
    expect(r.menu).toEqual([]);
  });

  it("with a menu extra, lists every filter that has options or a value", () => {
    const r = layoutExtras({ ...base, hasMenuExtra: true, hasSeries: false, pinAll: false, state: { ...none, series: "x" } });
    expect(r.menu).toContain("series");
  });
});
