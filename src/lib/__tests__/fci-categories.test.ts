import { describe, expect, it } from "vitest";
import {
  fciAdmittedText,
  fciCategoryLine,
  fciClassLine,
  fciRegistrationWindow,
  parseFciCategories,
} from "@/lib/watcher/extractors/fci-categories";

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

  it("reads the MTB calendar's initials, but only as a run", () => {
    const ages = parseFciCategories("CAT. ES-ALL-JU - OPEN M/F - CICLOAMATORI TUTTI - APERTA AGLI ENTI");
    expect(ages).toEqual(expect.arrayContaining(["youth", "junior", "amateur"]));
    // "all" and "ju" are ordinary Italian words on their own.
    expect(parseFciCategories("gara aperta all'iscrizione")).toEqual([]);
  });

  it("reads a licence as the racing categories it stands for", () => {
    expect(
      parseFciCategories("TESSERATI FCI APERTA AGLI ENTI COME DA CONVENZIONE"),
    ).toEqual(expect.arrayContaining(["junior", "u23", "elite", "masters"]));
    expect(parseFciCategories("TUTTE + ALTRI ENTI")).toContain("elite");
  });

  it("reads a non-competitive ride as open to anyone", () => {
    expect(parseFciCategories("PEDALATA NON COMPETITIVA")).toEqual(["amateur"]);
    expect(
      parseFciCategories(
        "Questo tipo di manifestazioni sono aperte a: tutti fino ad una distanza di 20 km.",
      ),
    ).toEqual(["amateur"]);
  });

  it("reads a top-class cyclocross that names both audiences", () => {
    const ages = parseFciCategories(
      "tutte FCI gara aperta agli Enti di Promozione gara top class solo per Esordienti ed Allievi con montepremi federale",
    );
    expect(ages).toEqual(expect.arrayContaining(["youth", "elite", "masters"]));
  });
});

/**
 * The page is a list of labelled fields; a value ends where the next label
 * begins. Taking everything after "Categorie ammesse" swept up the club name,
 * the phone number and the whole route description with it.
 */
describe("fciFields", () => {
  const page = `<html><body>
    <div>Classe:</div><div>(1.12) Elite e Under 23</div>
    <div>Categoria:</div><div>Nazionale</div>
    <div>Tipo:</div><div>In linea \ strada</div>
    <div>Categorie ammesse:</div><div></div>
    <div>Organizzatore:</div><div>G.S. MASTER FIGLINE BIKE</div>
    <div>Telefono:</div><div>3485810750</div>
  </body></html>`;

  it("stops a value at the next label", () => {
    expect(fciClassLine(page)).toBe("(1.12) Elite e Under 23");
    expect(fciCategoryLine(page)).toBeNull();
  });

  it("keeps a club name out of the categories", () => {
    // "MASTER" in the organiser's name is not a category anybody stated.
    expect(parseFciCategories(fciAdmittedText(page))).toEqual(
      expect.arrayContaining(["elite", "u23"]),
    );
    expect(parseFciCategories(fciAdmittedText(page))).not.toContain("masters");
  });
});

/**
 * Not one upcoming race in the catalogue carried an entry deadline: the reader
 * that finds one only ran on pages describing a single race, and every source
 * that reaches this catalogue is a calendar. The Italian race page states the
 * window outright.
 */
describe("fciRegistrationWindow", () => {
  const page = (iscrizioni: string) =>
    `<div>Email:</div><div>a@b.c</div><div>Iscrizioni:</div><div>${iscrizioni}</div>`;

  it("reads the pair of Italian dates", () => {
    expect(fciRegistrationWindow(page("26/01/2026  - 03/09/2026"))).toEqual({
      opensAt: "2026-01-26",
      closesAt: "2026-09-03",
    });
  });

  it("takes the entry window, not the online one below it", () => {
    expect(
      fciRegistrationWindow(
        page("11/09/2026 - 16/10/2026  Iscrizioni online:  16/10/2026 - 16/10/2026"),
      ).opensAt,
    ).toBe("2026-09-11");
  });

  it("says nothing when the field is blank or malformed", () => {
    expect(fciRegistrationWindow(page(""))).toEqual({ opensAt: null, closesAt: null });
    expect(fciRegistrationWindow(page("da definire"))).toEqual({ opensAt: null, closesAt: null });
    expect(fciRegistrationWindow(page("32/01/2026 - 03/13/2026"))).toEqual({
      opensAt: null,
      closesAt: null,
    });
  });
});
