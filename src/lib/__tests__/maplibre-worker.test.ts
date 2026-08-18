import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const worker = join(process.cwd(), "public/maplibre/maplibre-gl-worker.mjs");
const shared = join(process.cwd(), "public/maplibre/maplibre-gl-shared.mjs");

describe("MapLibre worker assets", () => {
  it("ships JS modules, not HTML fallbacks", () => {
    expect(existsSync(worker)).toBe(true);
    expect(existsSync(shared)).toBe(true);
    const head = readFileSync(worker, "utf8").slice(0, 80);
    expect(head.startsWith("<!")).toBe(false);
    expect(head).toContain("MapLibre");
    expect(readFileSync(worker, "utf8")).toContain("./maplibre-gl-shared.mjs");
  });
});
