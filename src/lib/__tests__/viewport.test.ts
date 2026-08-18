import { describe, expect, it } from "vitest";
import {
  expandViewport,
  viewportNeedsFetch,
  type ViewportBox,
} from "@/lib/geo/viewport";

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

describe("expandViewport", () => {
  it("grows the box on every side", () => {
    const next = expandViewport(prague, 0.5);
    expect(next.west).toBeCloseTo(13.95);
    expect(next.east).toBeCloseTo(14.95);
    expect(next.south).toBeCloseTo(49.75);
    expect(next.north).toBeCloseTo(50.35);
  });

  it("leaves a collapsed box alone", () => {
    const flat = { west: 14, south: 50, east: 14, north: 50 };
    expect(expandViewport(flat)).toEqual(flat);
  });
});

describe("viewportNeedsFetch", () => {
  const fetched = expandViewport(prague, 0.65);

  it("stays put for the camera we just loaded", () => {
    expect(viewportNeedsFetch(fetched, prague)).toBe(false);
  });

  it("stays put for a small pan still inside the fetched area", () => {
    const width = prague.east - prague.west;
    expect(viewportNeedsFetch(fetched, shift(prague, width * 0.2, 0))).toBe(false);
  });

  it("refetches after a pan toward the edge of loaded data", () => {
    const width = prague.east - prague.west;
    expect(viewportNeedsFetch(fetched, shift(prague, width * 1.2, 0))).toBe(true);
  });

  it("refetches after zooming out past the fetched box", () => {
    expect(viewportNeedsFetch(fetched, shift(prague, 0, 0, 3))).toBe(true);
  });

  it("does not refetch a deeper zoom inside the fetched box", () => {
    expect(viewportNeedsFetch(fetched, shift(prague, 0, 0, 0.5))).toBe(false);
  });

  it("treats a collapsed box as a change", () => {
    expect(
      viewportNeedsFetch(fetched, { west: 14, south: 50, east: 14, north: 50 }),
    ).toBe(true);
  });
});
