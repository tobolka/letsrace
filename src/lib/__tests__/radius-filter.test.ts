import { describe, expect, it } from "vitest";
import { eventsWithinRadius } from "@/lib/geo/radius";

describe("map radius filter", () => {
  const origin = { lat: 49.1951, lng: 16.6068, km: 50 };
  const races = [
    { id: "brno", location: { lat: 49.1951, lng: 16.6068 } },
    { id: "blansko", location: { lat: 49.363, lng: 16.644 } },
    // Within the query rectangle's corner, but over 50 km from its center.
    { id: "box-corner", location: { lat: 49.64, lng: 17.28 } },
    { id: "prague", location: { lat: 50.08, lng: 14.43 } },
    { id: "unknown", location: null },
  ];
  it("filters by actual distance, not rectangle membership", () => {
    expect(eventsWithinRadius(races, origin).map((e) => e.id)).toEqual(["brno", "blansko"]);
  });
  it("updates when the radius changes", () => {
    expect(eventsWithinRadius(races, { ...origin, km: 10 }).map((e) => e.id)).toEqual(["brno"]);
    expect(eventsWithinRadius(races, { ...origin, km: 100 }).map((e) => e.id)).toEqual(["brno", "blansko", "box-corner"]);
  });
  it("restores unlocated races and the original array when disabled", () => {
    expect(eventsWithinRadius(races, null)).toBe(races);
  });
});
