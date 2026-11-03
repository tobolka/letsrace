import { expect, it } from "vitest";
import { positiveCategoryDistance } from "@/lib/category-distance";
import { distinctCategories } from "@/lib/category-detail";
import { mergeCategoryEvidence } from "@/lib/catalog/merge-category-evidence";
import { radsportEventToParsed } from "@/lib/watcher/extractors/radsport";

it("does not turn missing, zero or invalid lengths into routes in the source reader", () => {
  const race = radsportEventToParsed({ id: 26670, title: "MTB-Rennen um die Michaelis-Schanze", eventDate: "2026-11-14", distances: [{ distanceKm: 0 }, { distanceKm: -2 }, { distanceKm: Number.NaN }, { distanceKm: null }, { distanceKm: 0, label: "0 km" }, { distanceKm: 0.2 }, { distanceKm: 0, label: "Elite" }, { label: "U15" }] });
  expect(race?.categories).toEqual([
    expect.objectContaining({ name: "0.2 km", distanceKm: 0.2 }),
    expect.objectContaining({ name: "Elite" }),
    expect.objectContaining({ name: "U15" }),
  ]);
  expect(race?.categories?.[1].distanceKm).toBeUndefined();
});

it("rejects invalid distances without discarding real sub-kilometre courses", () => {
  for (const value of [0, -1, null, undefined, Number.NaN, Infinity, "0"]) expect(positiveCategoryDistance(value)).toBeNull();
  expect(positiveCategoryDistance(0.2)).toBe(0.2);
});

it("filters legacy placeholders from the detail while retaining named classes", () => {
  const row = (name: string, distanceKm: number | null) => ({ name, distanceKm, ageMin: null, ageMax: null });
  expect(distinctCategories([row("0 km", 0), row("0,0 km", null), row("Elite", null), row("200 m", 0.2)])).toEqual([row("Elite", null), row("200 m", 0.2)]);
});

it("prevents another watcher from saving zero placeholders or erasing known distances", () => {
  const row = (name: string, distance_km: number | null) => ({ name, distance_km, age_min: null, age_max: null, audience: null });
  expect(mergeCategoryEvidence([row("Elite", 20)], [row("Elite", 0), row("0 km", 0), row("U15", 0), row("Kids", 0.2)])).toEqual([row("Elite", 20), row("U15", null), row("Kids", 0.2)]);
});
