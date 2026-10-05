import { expect, it } from "vitest";
import { nearbyEditionDate, verifiedDetailSpan } from "@/lib/catalog/raceresult-date";

it("only considers nearby single-day dates in the same edition", () => {
  expect(nearbyEditionDate("2026-10-10", "2026-10-11", "2026-10-11")).toBe(true);
  expect(nearbyEditionDate("2026-10-10", "2026-10-11", "2026-10-12")).toBe(false);
  expect(nearbyEditionDate("2026-10-10", "2027-10-11", "2027-10-11")).toBe(false);
  expect(nearbyEditionDate("2026-10-10", "2026-11-11", "2026-11-11")).toBe(false);
});

it("retains independently verified dates without freezing subsequent corrections", () => {
  const facts = [{ field: "start_date", value: "2026-10-11" }, { field: "end_date", value: "2026-10-11" }];
  expect(verifiedDetailSpan({ start: "2026-10-11", end: "2026-10-11" }, "2026-10-10", facts)).toEqual({ start: "2026-10-11", end: "2026-10-11" });
  expect(verifiedDetailSpan({ start: "2026-10-12", end: "2026-10-12" }, "2026-10-10", facts)).toBeNull();
  expect(verifiedDetailSpan({ start: "2026-10-11", end: "2026-10-11" }, "2026-10-10", [])).toBeNull();
});
