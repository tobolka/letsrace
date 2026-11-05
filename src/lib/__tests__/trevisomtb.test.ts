import { describe, expect, it } from "vitest";
import { parseTrevisoCards, placeFromTitle, trevisoEvent, trevisoMonths, type TrevisoRow } from "@/lib/watcher/extractors/trevisomtb";

const card = (dot: string, date: string, name: string, id: string, text = "Team organizza la prova") => `<div class="singolaNewsHomePage"><div class="abstractNewsHomePage"><div class="testoAbstractNewsElenco"><div class="titoloAnteprimaNewsHomePage"><img alt="Attivita" src="img/PallinoAttivita${dot}.png" />${date}<br /><div class="titoloNewsHomePage">${name}</div></div><div>${text}</div></div></div><div class="divLinkNewsElenco"><a href="Raggruppamenti.aspx?IDEvento=${id}" title="${name}">x</a></div></div>`;
const row = (over: Partial<TrevisoRow>): TrevisoRow => ({ id: "1", name: "Gara", startDate: "2027-01-03", activity: "05", summary: "", ...over });

describe("TrevisoMTB calendar", () => {
  it("reads a page's cards", () => {
    const rows = parseTrevisoCards(card("05", "03/01/2027", "GP CITTÀ DI VITTORIO VENETO", "15400") + card("03", "15/03/2027", "10° VAJONT  BIKE RACE", "15401"));
    expect(rows.map(r => [r.id, r.startDate, r.activity, r.name])).toEqual([["15400", "2027-01-03", "05", "GP CITTÀ DI VITTORIO VENETO"], ["15401", "2027-03-15", "03", "10° VAJONT BIKE RACE"]]);
  });
  it("skips a card with no date or no link", () => {
    expect(parseTrevisoCards(`<div class="singolaNewsHomePage"><div class="titoloNewsHomePage">Notizia</div></div>`)).toEqual([]);
  });
  it("takes the place from the end of a race page's title", () => {
    expect(placeFromTitle("<title>01/11/2026 - 6° TROFEO CITTÀ DI FIRENZE - Mugello (Fi) - TrevisoMTB</title>")).toBe("Mugello (Fi)");
    expect(placeFromTitle("<title>CALENDARIO EVENTI - TrevisoMTB</title>")).toBeNull();
  });
  it.each([
    ["05", "Cross", "", ["cx"]], ["02", "Coppa", "", ["road"]], ["03", "Trofeo", "prova di XCo", ["xco"]],
    ["03", "9 GO ENDURO", "", ["enduro"]], ["03", "GARA NAZIONALE CICLOCROSS", "", ["cx"]], ["03", "Gran Fondo Colli", "", ["xcm"]], ["01", "Veneto Cup Kids", "", ["xco"]],
  ])("gives dot %s, %s the right discipline", (activity, name, summary, discipline) => {
    expect(trevisoEvent(row({ activity, name, summary }), "Mugello (Fi)")?.discipline).toEqual(discipline);
  });
  it("marks children's events and leaves running and notices out", () => {
    expect(trevisoEvent(row({ activity: "01" }), "Roma")?.ageCategories).toEqual(["kids"]);
    expect(trevisoEvent(row({ activity: "07" }), "Roma")).toBeNull();
    expect(trevisoEvent(row({ activity: "09" }), "Roma")).toBeNull();
  });
  it("gives a stable id and its place in Italy", () => {
    expect(trevisoEvent(row({ id: "15400" }), "Vittorio Veneto (Tv)")).toMatchObject({ externalId: "trevisomtb-15400-2027-01-03", placeText: "Vittorio Veneto (Tv), Italia", countryHint: "IT", sourceUrl: "https://www.trevisomtb.it/Raggruppamenti.aspx?IDEvento=15400" });
  });
  it("reads coming months first, then this year's past months", () => {
    const months = trevisoMonths(new Date("2026-11-05T12:00:00Z"));
    expect(months.slice(0, 3)).toEqual([{ year: 2026, month: 11, past: false }, { year: 2026, month: 12, past: false }, { year: 2027, month: 1, past: false }]);
    expect(months.at(-1)).toEqual({ year: 2026, month: 1, past: true });
  });
});
