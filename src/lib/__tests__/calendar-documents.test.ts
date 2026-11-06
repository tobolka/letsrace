import { describe, expect, it } from "vitest";
import { calendarRows, rowOfRace } from "@/lib/catalog/calendar-documents";

const czech = `Listopad
so 07.11.2026 | Nové Město v Krušných horách | [Mistrovství Ústeckého kraje](https://www.cyklokros.cz/files/cx-vcpr-2026-propozice.pdf)
so-ne 07.-08.11.2026 | Zeddam (Nizozemsko) | Mistrovství Evropy v cyklokrosu
ne 15.11.2026 | Kyjov | [Slovácký Kros](https://www.cyklokros.cz/files/slovacky-kros-rozpis-kyjov-2026-final-2.pdf)
út 17.11.2026 | Prachatice | [JANEV Cup](https://www.cyklokros.cz/files/2026-12-05-prachatice-propozice-2026-v2-final.pdf) | JANEV Cup`;
const slovak = `8.11.2026 | 6. kolo: Grand Prix Sereď Cyklokros | Sereď | (https://www.cyklistikaszc.sk/sk/submenu/kalendar-vysledky/prihlasenie/i-2215) | (https://www.cyklistikaszc.sk/kalendar/plagat/plaga3b38.pdf) | (https://www.cyklistikaszc.sk/kalendar/propozicie/propof14.pdf) | (https://www.cyklistikaszc.sk/kalendar/vysledky/final8.pdf)`;

describe("documents in a calendar's rows", () => {
  it("reads the day and the regulations, and leaves rows without a file", () => {
    const rows = calendarRows(czech);
    expect(rows.map(row => row.date)).toEqual(["2026-11-07", "2026-11-15", "2026-11-17"]);
    expect(rows[1]!.regulations).toEqual(["https://www.cyklokros.cz/files/slovacky-kros-rozpis-kyjov-2026-final-2.pdf"]);
  });
  it("tells regulations from results and posters", () => {
    const [row] = calendarRows(slovak);
    expect(row!.regulations).toEqual(["https://www.cyklistikaszc.sk/kalendar/propozicie/propof14.pdf"]);
    expect(row!.results).toEqual(["https://www.cyklistikaszc.sk/kalendar/vysledky/final8.pdf"]);
  });
  it("reads a weekend", () => {
    expect(calendarRows("so-ne 12.-13.12.2026 | Veselí | [x](https://a.cz/f.pdf)")[0]).toMatchObject({ date: "2026-12-12", endDate: "2026-12-13" });
  });
  it("skips a sentence with several dates", () => {
    expect(calendarRows("Termíny 7.11.2026 a 8.11.2026 najdete [zde](https://a.cz/f.pdf)")).toEqual([]);
  });
});

describe("wider calendar rows", () => {
  it("takes the page's year for a date written without one", () => {
    expect(calendarRows("Termine 2027\n14.05. | Eisenstadt | [Ausschreibung](https://a.at/rennen/info)", "https://a.at/termine")[0]).toMatchObject({ date: "2027-05-14", regulations: ["https://a.at/rennen/info"] });
  });
  it("takes a link to another site as the organiser's, never the calendar's own or a social one", () => {
    const [row] = calendarRows("Kalender 2027\n14.05.2027 | Eisenstadt | [Rennen](https://rennen.at/) | [FB](https://facebook.com/x) | [mehr](https://kalender.at/r/1)", "https://kalender.at/");
    expect(row!.sites).toEqual(["https://rennen.at/"]);
  });
});

describe("a race's row", () => {
  const rows = calendarRows(czech);
  it("needs its day and its place", () => {
    expect(rowOfRace(rows, { name: "Slovácký Kros — Kyjov", start_date: "2026-11-15", municipality: "Kyjov" })?.text).toContain("Kyjov");
  });
  it("is found by the race's name when the place is written differently", () => {
    expect(rowOfRace(rows, { name: "Mistrovství Ústeckého kraje", start_date: "2026-11-07", municipality: "Krušné hory" })).not.toBeNull();
  });
  it("is not another day's row of that town", () => {
    expect(rowOfRace(rows, { name: "Janev Cup 2026 - Prachatice národní závod", start_date: "2026-11-15", municipality: "Prachatice" })).toBeNull();
  });
  it("stays out of it when two rows fit", () => {
    const two = calendarRows("8.11.2026 | Kyjov | [a](https://a.cz/1.pdf)\n8.11.2026 | Kyjov | [b](https://a.cz/2.pdf)");
    expect(rowOfRace(two, { name: "Závod", start_date: "2026-11-08", municipality: "Kyjov" })).toBeNull();
  });
});