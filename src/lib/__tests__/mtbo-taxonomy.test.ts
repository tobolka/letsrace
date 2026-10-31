import { describe, expect, it } from "vitest";
import { canonicalEventDisciplines, DISCIPLINE_TREE, expandDisciplineFilter, formatsFromDisciplines, inferDisciplines, matchesDisciplineFilter } from "@/lib/taxonomy";
import { disciplinesFromCsv } from "@/lib/catalog/csv-series-meta";

describe("MTBO catalogue filters", () => {
  it("keeps MTBO through normalisation and offers it in the MTB menu", () => {
    expect(canonicalEventDisciplines(["mtb", "mtbo"])).toEqual(["mtb", "mtbo"]);
    expect(formatsFromDisciplines(["mtbo"])).toEqual(["mtbo"]);
    expect(inferDisciplines("Český pohár MTBO")).toEqual(["mtbo"]);
    expect(disciplinesFromCsv("MTBO", "sprint")).toEqual(["mtb", "mtbo"]);
    expect(DISCIPLINE_TREE.find((d) => d.id === "mtb")?.children?.some((d) => d.id === "mtbo")).toBe(true);
  });
  it("finds orienteering under MTB and MTBO without matching XCO", () => {
    expect(expandDisciplineFilter(["mtb"])).toContain("mtbo");
    expect(matchesDisciplineFilter(["mtbo"], ["mtb"])).toBe(true);
    expect(matchesDisciplineFilter(["mtb", "mtbo"], ["mtbo"])).toBe(true);
    expect(matchesDisciplineFilter(["mtbo"], ["xco"])).toBe(false);
    expect(matchesDisciplineFilter(["xco"], ["mtbo"])).toBe(false);
  });
});
