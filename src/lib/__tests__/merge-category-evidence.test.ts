import { expect, it } from "vitest";
import { mergeCategoryEvidence, mergeStatedAges, type CategoryEvidence } from "@/lib/catalog/merge-category-evidence";

const category = (name: string, values: Partial<CategoryEvidence> = {}): CategoryEvidence => ({ name, distance_km: null, age_min: null, age_max: null, audience: null, ...values });

it("keeps classes from both sources and fills missing facts without deleting existing rows", () => {
  const original = [category("Děti", { id: "kids", age_max: 10 }), category("Dlouhá", { id: "long", distance_km: 50 })];
  const incoming = [category(" děti ", { age_min: 6 }), category("Masters", { age_min: 40 }), category("Dlouhá", { distance_km: 75 })];
  const merged = mergeCategoryEvidence(original, incoming);
  expect(merged).toEqual([category("Děti", { id: "kids", age_min: 6, age_max: 10 }), original[1], incoming[1], incoming[2]]);
  expect(mergeCategoryEvidence(merged, incoming)).toEqual(merged);
  expect(original[0]?.age_min).toBeNull();
});

it("combines confirmed ages from different sources, replacing old guesses", () => {
  expect(mergeStatedAges(["u11"], "explicit", ["elite", "u13"], [])).toEqual(["u11", "elite", "u13"]);
  expect(mergeStatedAges(["amateur", "masters"], "default", ["u11"], [])).toEqual(["u11"]);
  expect(mergeStatedAges(["u11"], "explicit", null, ["amateur", "masters"])).toEqual(["u11"]);
  expect(mergeStatedAges(null, null, null, ["amateur"])).toEqual(["amateur"]);
});

it("keeps ambiguous partial evidence rather than attaching it to an arbitrary route", () => {
  const routes = [category("Open", { distance_km: 50 }), category("Open", { distance_km: 75 })];
  const partial = [category("Open", { age_min: 18 })];
  const merged = mergeCategoryEvidence(routes, partial);
  expect(merged).toEqual([...routes, ...partial]);
  expect(mergeCategoryEvidence(merged, partial)).toEqual(merged);
});
