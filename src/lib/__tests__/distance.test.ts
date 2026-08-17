import { describe, expect, it } from "vitest";
import {
  distanceKm,
  formatDistanceKm,
  sortByDistanceFrom,
} from "@/lib/geo/distance";

describe("distance from me", () => {
  const prague = { lat: 50.0755, lng: 14.4378 };

  it("puts nearer races first", () => {
    const events = [
      { startDate: "2026-08-23", location: { lat: 49.2, lng: 16.6 } }, // Brno
      { startDate: "2026-08-22", location: { lat: 50.08, lng: 14.45 } }, // Prague
      { startDate: "2026-08-22", location: { lat: null, lng: null } },
    ];
    const sorted = sortByDistanceFrom(events, prague);
    expect(sorted[0]?.location?.lat).toBe(50.08);
    expect(sorted[1]?.location?.lat).toBe(49.2);
    expect(sorted[2]?.location?.lat).toBeNull();
  });

  it("leaves order alone without an origin", () => {
    const events = [
      { startDate: "2026-08-23", location: { lat: 49.2, lng: 16.6 } },
      { startDate: "2026-08-22", location: { lat: 50.08, lng: 14.45 } },
    ];
    expect(sortByDistanceFrom(events, null)).toBe(events);
  });

  it("formats walking and driving distances", () => {
    expect(formatDistanceKm(0.08, "cs")).toMatch(/m$/);
    expect(formatDistanceKm(12.4, "cs")).toContain("12");
    expect(distanceKm(prague, { lat: 50.0755, lng: 14.4378 })).toBeCloseTo(0, 5);
  });
});
