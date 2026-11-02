import { describe, expect, it } from "vitest";
import { categoryDetail, distinctCategories } from "@/lib/category-detail";

const cat = (name: string, distanceKm: number | null = null, ageMin: number | null = null, ageMax: number | null = null) => ({
  name,
  distanceKm,
  ageMin,
  ageMax,
});

describe("categoryDetail", () => {
  it("adds what the name does not already say", () => {
    expect(categoryDetail(cat("The Legend", 145), "cs")).toBe("145 km");
    expect(categoryDetail(cat("100 km", 100), "cs")).toBe("");
    expect(categoryDetail(cat("Junioři", 60, 17, 18), "cs")).toBe("60 km · 17–18 let");
    expect(categoryDetail(cat("Masters", null, 40, null), "en")).toBe("40+ years");
  });

  it("drops exact repeats", () => {
    expect(distinctCategories([cat("Run", 2.5), cat("run", 2.5), cat("Bike", 20)])).toHaveLength(2);
  });
});
