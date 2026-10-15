import { describe, expect, it } from "vitest";
import { clusterAction } from "@/components/map/cluster-action";

describe("cluster click action", () => {
  const venues = [{ lat: 49.2, lng: 16.6 }, { lat: 49.4, lng: 16.9 }];
  it("zooms to the group's real venues, with a gradual zoom ceiling", () => {
    expect(clusterAction(venues, 7.5)).toEqual({ type: "zoom", maxZoom: 9.5,
      bounds: { west: 16.6, east: 16.9, south: 49.2, north: 49.4 } });
  });
  it("expands races at the same venue without a pointless camera jump", () => {
    expect(clusterAction([venues[0], venues[0]], 7)).toEqual({ type: "expand" });
  });
  it("zooms a mixed group before expanding its coincident subgroup", () => {
    expect(clusterAction([venues[0], venues[0], venues[1]], 7).type).toBe("zoom");
  });
  it("caps the zoom and provides a fallback for nearby venues at maximum zoom", () => {
    expect(clusterAction(venues, 17).type).toBe("zoom");
    expect(clusterAction(venues, 17)).toMatchObject({ maxZoom: 18 });
    expect(clusterAction(venues, 18)).toEqual({ type: "expand" });
  });
});
