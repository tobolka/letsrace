import { expect, it } from "vitest";
import { routeSummary } from "@/lib/seo-race-copy";
import type { EventListItem } from "@/lib/events";
it("states a distance range without guessing a route count from equal lengths", () => {
  const event = { categories: [{ name: "StageRALLY", distanceKm: 69 }, { name: "Stage69", distanceKm: 69 }, { name: "Stage138", distanceKm: 138 }], ageCategories: ["kids"], ageConfidence: "explicit" } as EventListItem;
  expect(routeSummary(event, "cs")).toEqual(["Vzdálenosti 69–138 km"]);
  expect(routeSummary({ ...event, categories: [] }, "cs")).toEqual([]);
  expect(routeSummary({ ...event, categories: [{ id: "a", name: "Route", distanceKm: 12.5, ageMin: null, ageMax: null }] }, "en")).toEqual(["Distances 12.5 km"]);
});
