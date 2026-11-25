import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, LIST_COLUMNS, moveColumn, normalizeLayout } from "@/lib/list-columns";

describe("list columns", () => {
  it("falls back to the default for anything unreadable", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout("nope")).toEqual(DEFAULT_LAYOUT);
  });

  it("drops unknown columns and appends missing ones", () => {
    const out = normalizeLayout({ order: ["name", "ghost", "date"], hidden: ["name", "place"] });
    expect(out.order.slice(0, 2)).toEqual(["name", "date"]);
    expect(out.order).toHaveLength(LIST_COLUMNS.length);
    // The name can never be hidden.
    expect(out.hidden).not.toContain("name");
    expect(out.hidden).toContain("place");
  });

  it("moves a column to a new index", () => {
    expect(moveColumn(["date", "name", "place"], "place", 0)).toEqual(["place", "date", "name"]);
    expect(moveColumn(["date", "name"], "name", 5)).toEqual(["date", "name"]);
  });

  it("keeps metadata columns hidden by default and appends them hidden to older saved layouts", () => {
    const out = normalizeLayout({ order: ["date", "name", "place"], hidden: [] });
    for (const col of ["createdAt", "updatedAt", "lastSeenAt", "registrationClosesAt", "regulations", "source"] as const) {
      expect(DEFAULT_LAYOUT.hidden).toContain(col);
      expect(out.order).toContain(col);
      expect(out.hidden).toContain(col);
    }
  });
});
