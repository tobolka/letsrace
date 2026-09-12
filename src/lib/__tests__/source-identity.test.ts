import { describe, expect, it } from "vitest";
import { sourceEditionId } from "@/lib/watcher/source-identity";

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
  it("falls back to matching for a new source", () => {
    expect(sourceEditionId("2026-09-13", null)).toBeUndefined();
  });
});
