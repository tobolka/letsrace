import { expect, it } from "vitest";
import { originalCategory, verifyOriginalCategories } from "@/lib/catalog/original-categories";
const url = "https://organiser.test/rules.pdf";
it("preserves Polish birth cohorts without inventing a reference year or age band", () => {
  expect(originalCategory("młodzik i młodziczka, rocznik 2013–2014", url)).toMatchObject({ birthYearMin: 2013, birthYearMax: 2014, ageMin: null, ageMax: null });
});
it("reads explicit ages and keeps the exact source row", () => {
  const line = "kobiety 19–30 lat";
  expect(originalCategory(line, url)).toMatchObject({ name: line, quote: line, gender: "female", ageMin: 19, ageMax: 30 });
});
it("rejects wrong identity, fabricated row numbers and standings", () => {
  const lines = [{ n: 1, line: "U13", url }, { n: 2, line: "Cup-Endwertung U13", url }];
  expect(verifyOriginalCategories(lines, { identity_valid: false, categories: [{line: 1, name: "U13"}] })).toEqual([]);
  expect(verifyOriginalCategories(lines, { identity_valid: true, categories: [{line: 99, name: "U13"}] })).toEqual([]);
  expect(verifyOriginalCategories(lines, { identity_valid: true, categories: [{line: 1, name: "U13"}, {line: 2, name: "U13"}] }).map(c => c.name)).toEqual(["U13"]);
});

it("keeps concise literal names while rejecting headings, invented names and entry fee rows", () => {
  const lines = [{ n: 1, line: "Categories:", url }, { n: 2, line: "U13: € 11", url }, { n: 3, line: "MU13, WU15", url }];
  expect(verifyOriginalCategories(lines, { identity_valid: true, categories: [{line: 1, name: "Categories:"}, {line: 2, name: "U13"}, {line: 3, name: "U17"}, {line: 3, name: "MU13"}, {line: 3, name: "WU15"}] }).map(c => c.name)).toEqual(["MU13", "WU15"]);
});

it("requires individual approval even when an auditor says keep=true", async () => {
  const { acceptsOriginalAudit } = await import("@/lib/catalog/original-categories");
  const proposed = [{ name: "U15" }, { name: "U9-U19 XCO" }];
  expect(acceptsOriginalAudit(proposed, { keep: true, approvedNames: ["U15"] })).toBe(false);
  expect(acceptsOriginalAudit(proposed, { keep: true })).toBe(false);
  expect(acceptsOriginalAudit([{ name: "U15" }], { keep: true, approvedNames: ["U15"] })).toBe(true);
});
