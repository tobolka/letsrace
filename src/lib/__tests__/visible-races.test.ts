import { describe, expect, it } from "vitest";
import { visibleRaces } from "@/components/explore/use-map-list";
import type { EventListItem } from "@/lib/events";

const race = (id: string, lat: number | null, lng: number | null) =>
  ({ id, location: lat == null || lng == null ? null : { lat, lng } }) as unknown as EventListItem;

const BOX = { west: 14, south: 49, east: 16, north: 51 };
const base = {
  box: BOX,
  withinRadius: false,
  series: "",
  countries: [] as string[],
  q: "",
  placedQuery: "",
  selectedId: null as string | null,
};
const inside = race("in", 50, 15);
const outside = race("out", 40, 5);
const unplaced = race("none", null, null);

describe("visibleRaces", () => {
  it("clips to the camera's box", () => {
    expect(visibleRaces({ ...base, events: [inside, outside] })).toEqual([inside]);
  });

  it("never hides a race it could not place", () => {
    expect(visibleRaces({ ...base, events: [unplaced, outside] })).toEqual([unplaced]);
  });

  it("keeps the race you opened even when the map carried it away", () => {
    expect(visibleRaces({ ...base, events: [inside, outside], selectedId: "out" }).map((e) => e.id)).toEqual(["in", "out"]);
  });

  it("shows everything until the camera has settled", () => {
    expect(visibleRaces({ ...base, box: null, events: [inside, outside] })).toHaveLength(2);
  });

  it.each([
    ["a distance filter", { withinRadius: true }],
    ["a cup", { series: "kpz" }],
    ["a country", { countries: ["CZ"] }],
    ["a race-name search", { q: "prima" }],
  ])("is not a window when there is %s", (_name, change) => {
    expect(visibleRaces({ ...base, ...change, events: [inside, outside] })).toHaveLength(2);
  });

  it("is a window again once the search has flown the map to a place", () => {
    expect(visibleRaces({ ...base, q: "Vsetín", placedQuery: "Vsetín", events: [inside, outside] })).toEqual([inside]);
  });
});
