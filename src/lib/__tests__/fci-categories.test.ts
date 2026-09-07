import { describe, expect, it } from "vitest";
import { parseFciCategories } from "@/lib/watcher/extractors/fci-categories";

/**
 * Every line below is the "Categorie ammesse" text from a race that is in the
 * catalogue right now with no age categories at all.
 */
describe("parseFciCategories", () => {
  it("reads a listed ladder", () => {
    expect(
      parseFciCategories("ELITE-UNDER 23-JUNIOR M/F - MASTER TUTTI M/F - EPS convenzionati FCI"),
    ).toEqual(expect.arrayContaining(["elite", "u23", "junior", "masters"]));
  });

  it("maps the Italian youth ladder onto ours", () => {
    const ages = parseFciCategories(
      "ESORDIENTI M/F - ALLIEVI M/F - JUNIORES M/F - UNDER M/F - ELITE M/F",
    );
    expect(ages).toEqual(expect.arrayContaining(["youth", "junior", "u23", "elite"]));
    expect(ages).not.toContain("kids");
  });

  it("treats giovanissimi as children and giovanili as youth", () => {
    expect(parseFciCategories("GIOVANISSIMI M/F")).toEqual(["kids"]);
    expect(parseFciCategories("CATEGORIE AGONISTICHE GIOVANILI FEDERALI")).toContain("youth");
  });

  it("reads 'all racing categories' as the adults it means", () => {
    const ages = parseFciCategories("TUTTE LE CATEGORIE AGONISTICHE PREVISTE DAL REGOLAMENTO.");
    expect(ages).toEqual(expect.arrayContaining(["junior", "u23", "elite", "masters"]));
    // It says nothing about children, so neither do we.
    expect(ages).not.toContain("kids");
  });

  it("adds the children back when the page names them beside it", () => {
    const ages = parseFciCategories(
      "APERTA A TUTTE LE CATEGORIE AGONISTICHE FEDERALI + ENTI DELLA CONSULTA + CATEGORIE AGONISTICHE GIOVANILI FEDERALI",
    );
    expect(ages).toEqual(expect.arrayContaining(["elite", "youth"]));
  });

  it("says nothing when the page says nothing", () => {
    expect(parseFciCategories("")).toEqual([]);
    expect(parseFciCategories(null)).toEqual([]);
    expect(parseFciCategories("   ")).toEqual([]);
  });
});
