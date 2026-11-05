import { describe, expect, it } from "vitest";
import { settledSourceRow, sourceEditionId } from "@/lib/watcher/source-identity";

describe("durable source identity", () => {
  it("keeps a renamed or rescheduled race in the same season", () => {
    expect(sourceEditionId("2026-09-14", { id: "canonical", start_date: "2026-09-13" })).toBe("canonical");
  });
  it("resolves a reviewed duplicate to its keeper", () => {
    expect(sourceEditionId("2026-09-13", { id: "duplicate", start_date: "2026-09-13", merged_into_id: "canonical" })).toBe("canonical");
  });
  it("does not overwrite last year's edition when a source reuses its id", () => {
    expect(sourceEditionId("2027-09-13", { id: "old", start_date: "2026-09-13" })).toBeUndefined();
  });
  it("does not update a stored race in a different discipline when a source reuses its id", () => {
    const race = { name: "Perl Cycling Festival", startDate: "2026-09-13", placeText: "Perl" };
    expect(sourceEditionId(race.startDate, { id: "road", start_date: race.startDate }, {
      incoming: { ...race, disciplines: ["gravel"] },
      stored: { ...race, disciplines: ["road"] },
    })).toBeUndefined();
  });
  it("falls back to matching for a new source", () => {
    expect(sourceEditionId("2026-09-13", null)).toBeUndefined();
  });
});

describe("a row the source already filed", () => {
  const filed = { id: "race", start_date: "2026-11-21", merged_into_id: null };
  it("settles on its race when only a corrected detail disagrees that day", () => {
    expect(settledSourceRow("2026-11-21", filed, undefined)).toBe("race");
    expect(settledSourceRow("2026-11-21", { ...filed, merged_into_id: "keeper" }, undefined)).toBe("keeper");
  });
  it("does not interfere with a normal match, a moved date or a row never filed", () => {
    expect(settledSourceRow("2026-11-21", filed, "race")).toBeUndefined();
    expect(settledSourceRow("2026-11-28", filed, undefined)).toBeUndefined();
    expect(settledSourceRow("2026-11-21", null, undefined)).toBeUndefined();
  });
});
