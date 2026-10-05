import { describe, expect, it } from "vitest";
import { mayInheritSeriesAges } from "@/lib/catalog/series-ages";
describe("common series categories", () => {
  it("fills unknown, guessed and previous-season classes", () => {
    for (const age_confidence of [null, "default", "previous"]) expect(mayInheritSeriesAges({ age_categories: ["masters"], age_confidence })).toBe(true);
    expect(mayInheritSeriesAges({ age_categories: [], age_confidence: "explicit" })).toBe(true);
  });
  it("preserves a round's own stated classes and human locks", () => {
    expect(mayInheritSeriesAges({ age_categories: ["kids"], age_confidence: "explicit" })).toBe(false);
    for (const lock of ["age_categories", "age_confidence", "audience"]) expect(mayInheritSeriesAges({ age_categories: [], age_confidence: null, locked_fields: [lock] })).toBe(false);
  });
});
