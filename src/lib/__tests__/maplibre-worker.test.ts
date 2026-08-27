import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAPLIBRE_ASSET_DIR } from "../maplibre";

const maplibreVersion = JSON.parse(
  readFileSync(join(process.cwd(), "node_modules/maplibre-gl/package.json"), "utf8"),
).version as string;

const dir = join(process.cwd(), "public", "maplibre", maplibreVersion);
const boot = join(dir, "boot.mjs");
const main = join(dir, "maplibre-gl.mjs");
const worker = join(dir, "maplibre-gl-worker.mjs");
const shared = join(dir, "maplibre-gl-shared.mjs");

describe("MapLibre worker assets", () => {
  it("ships versioned JS modules, not HTML fallbacks", () => {
    expect(MAPLIBRE_ASSET_DIR).toBe(`/maplibre/${maplibreVersion}`);
    expect(existsSync(boot)).toBe(true);
    expect(existsSync(main)).toBe(true);
    expect(existsSync(worker)).toBe(true);
    expect(existsSync(shared)).toBe(true);
    const head = readFileSync(worker, "utf8").slice(0, 80);
    expect(head.startsWith("<!")).toBe(false);
    expect(head).toContain("MapLibre");
    expect(readFileSync(worker, "utf8")).toContain("./maplibre-gl-shared.mjs");
    expect(readFileSync(main, "utf8")).toContain("./maplibre-gl-shared.mjs");
    expect(readFileSync(boot, "utf8")).toContain("./maplibre-gl.mjs");
    expect(readFileSync(shared, "utf8")).toContain(" as zi");
  });
});
