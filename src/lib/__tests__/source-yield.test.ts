import { expect, it } from "vitest";
import { sourceEditionIsRepresented, sourceEditionExists, type StoredEdition } from "@/lib/catalog/source-yield";
const weekend: StoredEdition = { externalId: "round-2", start_date: "2026-11-14", end_date: "2026-11-15", visibility: "public", merged_into_id: null };
it("recognizes the second day of an already imported weekend", () => {
  expect(sourceEditionIsRepresented([weekend], "round-2", "2026-11-15")).toBe(true);
});
it("does not mask an absent round, other edition or hidden/merged race", () => {
  expect(sourceEditionIsRepresented([weekend], "another-round", "2026-11-15")).toBe(false);
  expect(sourceEditionIsRepresented([weekend], "round-2", "2027-11-15")).toBe(false);
  expect(sourceEditionIsRepresented([{ ...weekend, visibility: "hidden" }], "round-2", "2026-11-15")).toBe(false);
  expect(sourceEditionIsRepresented([{ ...weekend, merged_into_id: "canonical" }], "round-2", "2026-11-15")).toBe(false);
  expect(sourceEditionIsRepresented([{ ...weekend, end_date: null }], "round-2", "2026-11-15")).toBe(false);
});

it("distinguishes a hidden existing edition from an absent source link", () => {
  expect(sourceEditionExists([{ ...weekend, visibility: "hidden" }], "round-2", "2026-11-15")).toBe(true);
  expect(sourceEditionExists([weekend], "unlinked-round", "2026-11-15")).toBe(false);
});
