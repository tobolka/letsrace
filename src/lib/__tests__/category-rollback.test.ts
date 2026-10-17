import { describe, expect, it } from "vitest";
import { sameCategoryRows } from "../catalog/facts";

describe("original category rollback", () => {
  const row = { id: "imported", event_id: "race", name: "U15 2013–2014", age_min: null, age_max: null, gender: null };
  it("matches imported rows while preserving independently added rows", () => {
    expect(sameCategoryRows([row], [{ ...row }, { ...row, id: "later" }])).toBe(true);
  });
  it("refuses to remove a later correction or a different race's row", () => {
    expect(sameCategoryRows([row], [{ ...row, name: "Corrected" }])).toBe(false);
    expect(sameCategoryRows([row], [{ ...row, event_id: "other" }])).toBe(false);
    expect(sameCategoryRows([row], [])).toBe(false);
    expect(sameCategoryRows([], [])).toBe(false);
  });
});
