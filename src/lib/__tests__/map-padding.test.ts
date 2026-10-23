import { describe, expect, it } from "vitest";
import { mapPaddingFor } from "@/components/explore/use-map-padding";

describe("mapPaddingFor", () => {
  it("leaves the camera the room the phone's sheet does not cover", () => {
    expect(mapPaddingFor({ isDesktop: false, hasCard: false, snap: 0.5, viewportH: 800 })).toEqual({
      top: 16, right: 12, bottom: 400 + 12, left: 12,
    });
  });

  it("never lets the sheet take more than 55% of the screen, or 640px", () => {
    expect(mapPaddingFor({ isDesktop: false, hasCard: false, snap: 0.92, viewportH: 800 }).bottom).toBe(440 + 12);
    expect(mapPaddingFor({ isDesktop: false, hasCard: false, snap: 0.92, viewportH: 2000 }).bottom).toBe(640 + 12);
  });

  it("reads a snap given as a CSS length, and falls back to half the screen for nonsense", () => {
    expect(mapPaddingFor({ isDesktop: false, hasCard: false, snap: "112px", viewportH: 800 }).bottom).toBe(112 + 12);
    expect(mapPaddingFor({ isDesktop: false, hasCard: false, snap: "tall", viewportH: 800 }).bottom).toBe(400 + 12);
  });

  it("on a desktop only the race card covers the camera's left edge", () => {
    expect(mapPaddingFor({ isDesktop: true, hasCard: false, snap: 0.5, viewportH: 800 })).toEqual({
      top: 16, right: 56, bottom: 56, left: 48,
    });
    expect(mapPaddingFor({ isDesktop: true, hasCard: true, snap: 0.5, viewportH: 800 }).left).toBe(48 + 332);
  });
});
