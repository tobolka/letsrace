import { describe, expect, it } from "vitest";
import { viewportChangedEnough, type ViewportBox } from "@/lib/geo/viewport";

const prague: ViewportBox = {
  west: 14.2,
  south: 49.9,
  east: 14.7,
  north: 50.2,
};

function shift(box: ViewportBox, dx: number, dy: number, scale = 1): ViewportBox {
  const cx = (box.west + box.east) / 2;
  const cy = (box.south + box.north) / 2;
  const hw = ((box.east - box.west) / 2) * scale;
  const hh = ((box.north - box.south) / 2) * scale;
  return {
    west: cx + dx - hw,
    south: cy + dy - hh,
    east: cx + dx + hw,
    north: cy + dy + hh,
  };
}

describe("viewportChangedEnough", () => {
  it("ignores an identical camera", () => {
    expect(viewportChangedEnough(prague, { ...prague })).toBe(false);
  });

  it("ignores a tiny nudge", () => {
    const width = prague.east - prague.west;
    expect(viewportChangedEnough(prague, shift(prague, width * 0.05, 0))).toBe(false);
  });

  it("refetches after a real pan", () => {
    const width = prague.east - prague.west;
    expect(viewportChangedEnough(prague, shift(prague, width * 0.3, 0))).toBe(true);
  });

  it("refetches after a meaningful zoom", () => {
    expect(viewportChangedEnough(prague, shift(prague, 0, 0, 0.5))).toBe(true);
    expect(viewportChangedEnough(prague, shift(prague, 0, 0, 2))).toBe(true);
  });

  it("treats a collapsed box as a change", () => {
    expect(
      viewportChangedEnough(prague, { west: 14, south: 50, east: 14, north: 50 }),
    ).toBe(true);
  });
});
