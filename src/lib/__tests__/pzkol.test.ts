import { describe, expect, it } from "vitest";
import { parsePzkolCalendar, parsePzkolDateRange } from "@/lib/watcher/extractors/pzkol";

const row = (date: string, name: string, place: string, id = "2670", region = "POL") => `
  <tr>
    <td><a href="https://pzkol.pl/kalendarz/${id},slug.html">${date}</a></td>
    <td><a href="https://pzkol.pl/kalendarz/${id},slug.html">${name}</a></td>
    <td><a href="#" title="Polski Związek Kolarski">${place}</a></td>
    <td><a href="#" title="Puchar Polski">PP</a></td>
    <td><a href="#">${region}</a></td>
    <td></td><td></td>
  </tr>`;

const table = (...rows: string[]) =>
  `<table><thead><tr><th>Data</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;

describe("parsePzkolDateRange", () => {
  it("reads a single day", () => {
    expect(parsePzkolDateRange("03.01.2026")).toEqual({
      startDate: "2026-01-03",
      endDate: undefined,
    });
  });

  it("reads a same-month range", () => {
    expect(parsePzkolDateRange("21-22.02.2026")).toEqual({
      startDate: "2026-02-21",
      endDate: "2026-02-22",
    });
  });

  it("reads a same-month range with a one-digit first day", () => {
    expect(parsePzkolDateRange("9-11.01.2026")).toEqual({
      startDate: "2026-01-09",
      endDate: "2026-01-11",
    });
  });

  it("reads a range that crosses months", () => {
    expect(parsePzkolDateRange("30.04-3.05.2026")).toEqual({
      startDate: "2026-04-30",
      endDate: "2026-05-03",
    });
  });

  it("rejects anything else", () => {
    expect(parsePzkolDateRange("wkrótce")).toBeNull();
    expect(parsePzkolDateRange("31.13.2026")).toBeNull();
  });
});

describe("parsePzkolCalendar", () => {
  const url = "https://pzkol.pl/kalendarz?v=l&season=2026";

  it("reads a race off the season table", () => {
    const [ev] = parsePzkolCalendar(
      url,
      table(row("06.09.2026", "32 Puchar Tarnowa MTB XCO", "Tarnów")),
    );
    expect(ev).toMatchObject({
      externalId: "pzkol-2670",
      name: "32 Puchar Tarnowa MTB XCO",
      startDate: "2026-09-06",
      placeText: "Tarnów",
      countryHint: "PL",
      discipline: ["xco"],
      audience: "mixed",
      sourceUrl: "https://pzkol.pl/kalendarz/2670,slug.html",
    });
  });

  it("infers Polish discipline names", () => {
    const events = parsePzkolCalendar(
      url,
      table(
        row("04.01.2026", "Puchar Polski w Kolarstwie Przełajowym", "Trzcianka", "1"),
        row("06.09.2026", "55 Ogólnopolskie Kryterium Kolarskie", "Wieluń", "2"),
        row("13.09.2026", "XV Jubileuszowa Czasówka Kaczawska", "Wojcieszów", "3"),
        row("06.09.2026", "Puchar Polski #5 Pumptrack", "Przeciszów", "4"),
      ),
    );
    expect(events.map((e) => e.discipline)).toEqual([["cx"], ["criterium"], ["tt"], ["bmx"]]);
  });

  it("marks youth races as kids", () => {
    const [ev] = parsePzkolCalendar(
      url,
      table(row("06.09.2026", "Mistrzostwa Polski Szkół Podstawowych w kolarstwie MTB", "Śrem")),
    );
    expect(ev!.audience).toBe("kids");
  });

  it("keeps a foreign round's own country", () => {
    const [ev] = parsePzkolCalendar(
      url,
      table(row("06.09.2026", "Wyścig", "Praha", "9", "CZE")),
    );
    expect(ev!.countryHint).toBe("CZ");
  });

  it("skips indoor cycling and rows without a date", () => {
    const events = parsePzkolCalendar(
      url,
      table(
        row("06.09.2026", "Mistrzostwa Polski w kolarstwie halowym", "Świdnica", "5"),
        row("termin wkrótce", "Wyścig o Puchar Starosty", "Wysocko", "6"),
      ),
    );
    expect(events).toHaveLength(0);
  });

  it("does not repeat a race listed twice", () => {
    const events = parsePzkolCalendar(
      url,
      table(
        row("06.09.2026", "32 Puchar Tarnowa MTB XCO", "Tarnów", "77"),
        row("06.09.2026", "32 Puchar Tarnowa MTB XCO", "Tarnów", "77"),
      ),
    );
    expect(events).toHaveLength(1);
  });
});
