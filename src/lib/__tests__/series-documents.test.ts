import { describe, expect, it } from "vitest";
import { roundWithinSeriesSeason, verifySeriesDocument, type SeriesDocumentVerdict } from "@/lib/catalog/series-documents";

const text = "STEVENS Cyclo-Cross-Cup\nGeneralausschreibung Saison 2026/27\nU11\nU13\nU15\nU17\nJunioren\nElite\nMasters";
const verdict: SeriesDocumentVerdict = { applies_all_rounds: true, complete_categories: true, exceptions: [], series_quote: "STEVENS Cyclo-Cross-Cup", season: "2026/27", season_quote: "Generalausschreibung Saison 2026/27", category_lines: [3, 4, 5, 6, 7, 8, 9], rules_document: true };

describe("shared series documents", () => {
  it("maps source category lines with children's umbrella bands", () => {
    const found = verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", text, verdict);
    expect(found?.ages).toEqual(expect.arrayContaining(["u11", "u13", "u15", "u17", "kids", "youth", "junior", "elite", "masters"]));
    expect(found?.rules).toBe(true);
  });
  it.each([
    { complete_categories: false, rules_document: false }, { applies_all_rounds: false }, { exceptions: ["Finale"] },
    { series_quote: "Another Cup" }, { season_quote: "Saison 2025/26" }, { season: "2027" },
    { category_lines: [3, 500] }, { category_lines: [3] }, { season: "2026/29" },
  ])("rejects partial, different edition, fabricated or exceptional evidence: %j", (change) => {
    expect(verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", text, { ...verdict, ...change })).toBeNull();
  });
  it("does not carry winter rules into the next summer or autumn", () => {
    const evidence = { seasonStart: 2026, seasonEnd: 2027 };
    expect(roundWithinSeriesSeason("2026-10-10", evidence)).toBe(true);
    expect(roundWithinSeriesSeason("2027-01-10", evidence)).toBe(true);
    expect(roundWithinSeriesSeason("2027-07-01", evidence)).toBe(false);
    expect(roundWithinSeriesSeason("2026-06-30", evidence)).toBe(false);
  });
  it("accepts verified common propositions without promoting an incomplete category list", () => {
    const evidence = verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", text, { ...verdict, complete_categories: false, category_lines: [] });
    expect(evidence?.rules).toBe(true);
    expect(evidence?.ages).toEqual([]);
  });
  it("does not use Cup-Endwertung as exhaustive category eligibility", () => {
    const scoring = "STEVENS Cyclo-Cross-Cup\nSaison 2026/27\nKategorien für Cup-Endwertung\nHerren Gesamt Junioren\nMU17 WU17 MU15 WU15\nFrauen Master";
    const evidence = verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", scoring, { ...verdict, season_quote: "Saison 2026/27", category_lines: [4, 5, 6] });
    expect(evidence?.ages).toEqual([]);
    expect(evidence?.rules).toBe(true);
  });
  it("accepts a source calendar when an office document's season header is an image", () => {
    const calendar = `${text}\n26.09.2026 Oldenburg\n18.10.2026 Bad Essen\n24.01.2027 Finale\nClasses use 2027`;
    expect(verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", calendar, { ...verdict, season_quote: "Classes use 2027" })).not.toBeNull();
    expect(verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", calendar, { ...verdict, season_quote: "Classes use 2027", rules_document: false })).toBeNull();
  });
  it("maps sex suffixes and slash-separated classes without losing U23 or U13", () => {
    const list = "STEVENS Cyclo-Cross-Cup\nSaison 2026/27\nElite; U23m; U23w\nU11/13; Junioren";
    expect(verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", list, { ...verdict, season_quote: "Saison 2026/27", category_lines: [3, 4] })?.ages)
      .toEqual(expect.arrayContaining(["u11", "u13", "kids", "youth", "junior", "u23", "elite"]));
  });
  it("does not silently interpret birth years in the wrong year of a winter season", () => {
    const births = text.replace("U11", "Kinder 2015 - 2016");
    expect(verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", births, verdict)?.ages).toEqual([]);
    expect(verifySeriesDocument("STEVENS CycloCross-Cup 2026/27", births, { ...verdict, rules_document: false })).toBeNull();
  });
});

it("uses a verbatim season-scoped series heading when the separate season quote is empty", () => {
  const document = "REGULAMIN ROBINSONADA 2026 r.\nShared admission rules for all rounds";
  expect(verifySeriesDocument("Robinsonada 2026", document, { applies_all_rounds: true, complete_categories: false, exceptions: [], series_quote: "REGULAMIN ROBINSONADA 2026 r.", season: "2026", season_quote: "", rules_document: true })?.rules).toBe(true);
  expect(verifySeriesDocument("Robinsonada 2026", document, { applies_all_rounds: true, complete_categories: false, exceptions: [], series_quote: "REGULAMIN ROBINSONADA 2026 r.", season: "2027", season_quote: "", rules_document: true })).toBeNull();
});
