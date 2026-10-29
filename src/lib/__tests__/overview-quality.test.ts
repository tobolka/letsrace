import { expect, it } from "vitest";
import { catalogueWindow, missingOverviewFields, overviewIssues, fairCatalogueBatch } from "@/lib/catalog/overview-quality";
it("covers next December and does not demand detailed categories or registration", () => {
  expect(catalogueWindow("2026-10-25")).toEqual({ from: "2026-10-25", until: "2027-12-31" });
  expect(missingOverviewFields({ name: "Pražská 50", start_date: "2027-09-18", website_url: null, disciplines: ["mtb"], location: { municipality: "Praha", country_code: "CZ" }, sources: [{ kind: "official", source_url: "https://prazska50.cz/" }] })).toEqual([]);
});
it("flags impossible dates and future completion without misclassifying a winter season", () => {
  expect(overviewIssues({ name: "Race 2026", start_date: "2027-05-01", end_date: "2027-04-30", status: "completed" }, "2026-10-25")).toEqual(["end_before_start", "completed_in_future", "name_year_conflict"]);
  expect(overviewIssues({ name: "Cross Cup 2026/27", start_date: "2027-01-10" }, "2026-10-25")).toEqual([]);
  expect(overviewIssues({ name: "Race", start_date: "2027-02-30" }, "2026-10-25")).toContain("invalid_date");
});
it("does not starve next season or a small country behind a large calendar", () => {
  const rows = [...Array.from({ length: 20 }, (_, n) => ({ n, group: "CZ-2026" })), { n: 99, group: "CZ-2027" }, { n: 100, group: "SK-2027" }];
  expect(fairCatalogueBatch(rows, 4, r => r.group).map(r => r.n)).toEqual([0, 99, 100, 1]);
});
it("accepts the verified Fundacja 2036 brand without accepting arbitrary conflicting years", () => {
  expect(overviewIssues({ name: "GRAND PRIX OF POLAND - 2036 CUP", start_date: "2026-08-15", end_date: "2026-08-16" }, "2026-10-29")).toEqual([]);
  expect(overviewIssues({ name: "GRAND PRIX OF POLAND - 2036 CUP 2025", start_date: "2026-08-15" }, "2026-10-29")).toContain("name_year_conflict");
  expect(overviewIssues({ name: "Other Cup 2036", start_date: "2026-08-15" }, "2026-10-29")).toContain("name_year_conflict");
});
it("does not count a country placeholder as a populated town", () => {
  expect(missingOverviewFields({ name: "Race", start_date: "2027-04-04", website_url: "https://race.test", disciplines: ["road"], location: { municipality: "Austria", country_code: "AT" } })).toEqual(["place"]);
});
