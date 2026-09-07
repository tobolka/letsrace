import { describe, expect, it } from "vitest";
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_TREE,
  canonicalEventDisciplines,
} from "@/lib/taxonomy";

/**
 * Para-cycling was a discipline of its own until every race carrying it turned
 * out to also be a road race — eight of them, none para-only. A tag that never
 * rides alone bought a filter, a colour and a label for nothing.
 *
 * The rows in the database still hold it, so what matters is that reading them
 * folds it into road rather than leaking a bare "para" onto a card.
 */
describe("retired disciplines", () => {
  it("folds a stored para tag into road", () => {
    expect(canonicalEventDisciplines(["road", "para"])).toEqual(["road"]);
    expect(canonicalEventDisciplines(["para"])).toEqual(["road"]);
  });

  it("offers no para filter and no para label", () => {
    // `id` is typed as a live discipline, so compare as plain strings — the
    // point of the test is the data, and narrowing would make it a tautology.
    expect(DISCIPLINE_TREE.map((n) => n.id as string)).not.toContain("para");
    expect(Object.keys(DISCIPLINE_LABELS)).not.toContain("para");
  });
});
