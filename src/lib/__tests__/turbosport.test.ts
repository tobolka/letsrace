import { describe, expect, it } from "vitest";
import { parseTurboSport, placeFrom } from "@/lib/watcher/extractors/turbosport";

const link = (href: string, label: string) => `<a href="${href}">${label}</a>`;
const url = "https://turbo-sport.eu/events";

describe("parseTurboSport", () => {
  it("reads a race off the two-digit-year list", () => {
    const [ev] = parseTurboSport(
      url,
      link("/events/stadtmeisterschaft-wolfratshausen", "06.09.26 Stadtmeisterschaft Wolfratshausen"),
    );
    expect(ev).toMatchObject({
      externalId: "turbosport-stadtmeisterschaft-wolfratshausen",
      name: "Stadtmeisterschaft Wolfratshausen",
      startDate: "2026-09-06",
      placeText: "Wolfratshausen",
      countryHint: "DE",
      discipline: ["road"],
      sourceUrl: "https://turbo-sport.eu/events/stadtmeisterschaft-wolfratshausen",
    });
  });

  it("reads the /veranstaltungen path too", () => {
    const [ev] = parseTurboSport(url, link("/veranstaltungen/dachau", "15.08.26 Dachauer Bergkriterium"));
    expect(ev!.externalId).toBe("turbosport-dachau");
  });

  it("does not list the same race twice", () => {
    const html = link("/events/moosach", "11.07.26 Moosach Crit") + link("/events/moosach", "11.07.26 Moosach Crit");
    expect(parseTurboSport(url, html)).toHaveLength(1);
  });

  it("skips the series page and anything undated", () => {
    const html =
      link("/veranstaltungen/donnerstagsrennen", "2026 Donnerstagsrennen Serie") +
      link("/veranstaltungen/vorlage-4/anmeldung", "Anmeldung Sturm auf die Veste") +
      link("/events/x", "Ergebnisse");
    expect(parseTurboSport(url, html)).toHaveLength(0);
  });

  it("ignores links that are not events", () => {
    expect(parseTurboSport(url, link("/impressum", "06.09.26 Impressum"))).toHaveLength(0);
  });
});

describe("placeFrom", () => {
  it("turns the adjectival form back into a town", () => {
    expect(placeFrom("Obergünzburger RR", "augsburg")).toBe("Obergünzburg");
    expect(placeFrom("32. Ansbacher RSG-Radrennen", "ansbach")).toBe("Ansbach");
  });

  it("reads a town named after the race kind", () => {
    expect(placeFrom("Stadtmeisterschaft Wolfratshausen", "x")).toBe("Wolfratshausen");
  });

  it("refuses to read an adjective as a town", () => {
    expect(placeFrom("Großer Fritz Neuser Preis", "schwabacher-stadtparkrennen")).toBe("");
    expect(placeFrom("Offener Preis der Gemeinde", "vorlage-4")).toBe("");
  });

  it("leaves a race unplaced rather than guessing", () => {
    expect(placeFrom("BMW 4er-Mannschaftszeitfahren", "bmw-vierer-mannschaftszeitfahren")).toBe("");
    expect(placeFrom("Sturm auf die Veste", "vorlage-4")).toBe("");
  });

  it("falls back to a single-word slug", () => {
    expect(placeFrom("Kampenkönig", "moosach")).toBe("Moosach");
  });
});
