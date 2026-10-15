import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSmoothWheelZoom, type WheelMap } from "@/components/map/smooth-wheel-zoom";

afterEach(() => vi.unstubAllGlobals());
function setup(startZoom = 7, reduced = false) {
  let now = 0, zoom = startZoom, sequence = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const listeners = new Map<string, EventListener>();
  const moves: { zoom: number; center: { lat: number; lng: number } }[] = [];
  const container = { clientHeight: 600,
    addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as HTMLElement;
  const map = {
    stop: vi.fn(), getZoom: () => zoom, getMinZoom: () => 4, getMaxZoom: () => 18,
    getSize: () => ({ x: 800, y: 600 }),
    mouseEventToContainerPoint: () => ({ x: 200, y: 150 }),
    containerPointToLatLng: () => ({ lat: 30, lng: 40 }),
    project: ([lat, lng]: number[], z: number) => ({ x: lng * 2 ** z, y: lat * 2 ** z }),
    unproject: ([x, y]: number[], z: number) => ({ lng: x / 2 ** z, lat: y / 2 ** z }),
    _moveStart: vi.fn(), _moveEnd: vi.fn(),
    _move: (center: { lat: number; lng: number }, next: number) => { zoom = next; moves.push({ zoom, center }); },
  } as unknown as WheelMap;
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("Element", class {});
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { frames.set(++sequence, fn); return sequence; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const detach = attachSmoothWheelZoom(map, container);
  const wheel = (deltaY: number, deltaMode = 0) => {
    const e = { deltaY, deltaMode, target: null, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.get("wheel")?.(e as unknown as Event); return e;
  };
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 16;
      const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn(now));
    }
  };
  return { map, moves, wheel, tick, detach, frames, listeners };
}

describe("continuous map wheel zoom", () => {
  it("responds on the first frame, follows fractional input and settles once for a stream", () => {
    const s = setup();
    for (let i = 0; i < 20; i++) { s.wheel(-8); s.tick(); }
    expect(s.moves[0].zoom).toBeGreaterThan(7);
    expect(s.moves[0].zoom).toBeLessThan(7.05);
    expect(s.map._moveStart).toHaveBeenCalledTimes(1);
    expect(s.map._moveEnd).not.toHaveBeenCalled();
    s.tick(50);
    expect(s.map.getZoom()).toBeCloseTo(8, 8);
    expect(s.map._moveEnd).toHaveBeenCalledTimes(1);
    expect(s.frames.size).toBe(0);
    // The geographic point under the cursor stays at the same screen pixel.
    for (const { zoom, center } of s.moves) {
      expect((40 - center.lng) * 2 ** zoom + 400).toBeCloseTo(200, 7);
      expect((30 - center.lat) * 2 ** zoom + 300).toBeCloseTo(150, 7);
    }
  });
  it("reverses direction immediately without waiting for the previous animation", () => {
    const s = setup(); s.wheel(-80); s.tick(8);
    const before = s.map.getZoom(); s.wheel(120); s.tick();
    expect(s.map.getZoom()).toBeLessThan(before);
    s.tick(50); expect(s.map._moveEnd).toHaveBeenCalledTimes(1);
  });
  it("clamps zoom and avoids work for input pushing beyond a limit", () => {
    const s = setup(18); const e = s.wheel(-100);
    expect(e.preventDefault).toHaveBeenCalled(); expect(s.frames.size).toBe(0);
    expect(s.map._moveStart).not.toHaveBeenCalled();
    for (let i = 0; i < 50; i++) s.wheel(500);
    s.tick(80); expect(s.map.getZoom()).toBe(4);
  });
  it("normalizes line-based wheels and respects reduced motion", () => {
    const s = setup(7, true); s.wheel(-2, 1); s.tick();
    expect(s.map.getZoom()).toBeCloseTo(7.2);
  });
  it("cancels pending frames and removes listeners on unmount", () => {
    const s = setup(); s.wheel(-40); s.detach(); s.tick(20);
    expect(s.moves).toHaveLength(0); expect(s.frames.size).toBe(0); expect(s.listeners.size).toBe(0);
  });
});
