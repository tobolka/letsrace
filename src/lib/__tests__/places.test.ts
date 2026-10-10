import { describe, expect, it } from "vitest";
import { formatPlaceName, splitPlace } from "@/lib/places";

describe("formatPlaceName", () => {
  it("puts a shouted Czech town back into sentence case", () => {
    expect(formatPlaceName("HRADEC KRÁLOVÉ")).toBe("Hradec Králové");
    expect(formatPlaceName("PLZEŇ")).toBe("Plzeň");
    expect(formatPlaceName("MLADÁ BOLESLAV")).toBe("Mladá Boleslav");
  });

  it("keeps the joining words lowercase", () => {
    expect(formatPlaceName("ÚSTÍ NAD LABEM")).toBe("Ústí nad Labem");
    expect(formatPlaceName("FRANKFURT AM MAIN")).toBe("Frankfurt am Main");
    expect(formatPlaceName("MONTERONI D'ARBIA")).toBe("Monteroni d'Arbia");
  });

  it("leaves anything already cased exactly as its source wrote it", () => {
    expect(formatPlaceName("Hradec Králové")).toBe("Hradec Králové");
    expect(formatPlaceName("s-Hertogenbosch")).toBe("s-Hertogenbosch");
    expect(formatPlaceName("Black & White am Brunnen")).toBe("Black & White am Brunnen");
  });

  it("does not touch postcodes or short codes standing next to a town", () => {
    expect(formatPlaceName("IG6 3HP")).toBe("IG6 3HP");
    expect(formatPlaceName("D-94034 PASSAU")).toBe("D-94034 Passau");
    expect(formatPlaceName("OSOPPO UD")).toBe("Osoppo UD");
    expect(formatPlaceName("UCI C1")).toBe("UCI C1");
  });

  it("keeps the separators a place name is written with", () => {
    expect(formatPlaceName("BOLZANO/BOZEN")).toBe("Bolzano/Bozen");
    expect(formatPlaceName("FRÝDEK-MÍSTEK")).toBe("Frýdek-Místek");
  });

  it("passes empty values straight through", () => {
    expect(formatPlaceName(null)).toBeNull();
    expect(formatPlaceName("")).toBeNull();
    expect(formatPlaceName("   ")).toBeNull();
  });
});

describe("splitPlace", () => {
  it("keeps the town and the venue before it", () => {
    expect(splitPlace("Festhalle, Güntersleben")).toEqual({ town: "Güntersleben", venue: "Festhalle" });
    expect(splitPlace("Grillhütte am Maifeldradweg, Naunheim")).toEqual({ town: "Naunheim", venue: "Grillhütte am Maifeldradweg" });
  });

  it("drops a country or region a source appended", () => {
    expect(splitPlace("Kirchzarten, Germany").town).toBe("Kirchzarten");
    expect(splitPlace("Pilsen (Plzeň), Czechia").town).toBe("Pilsen (Plzeň)");
    expect(splitPlace("Bratislava, Slovensko").town).toBe("Bratislava");
    expect(splitPlace("Söll, Tirol").town).toBe("Söll");
    expect(splitPlace("Edinburgh, Scotland").town).toBe("Edinburgh");
  });

  it("has no town for a country code or a placeholder", () => {
    for (const v of ["DE", "CZ", "TBC", "lokalita v jednání", "...", "[?]", "", null]) {
      expect(splitPlace(v)).toEqual({ town: null, venue: null });
    }
  });

  it("leaves real short towns and city-states alone", () => {
    expect(splitPlace("Aš").town).toBe("Aš");
    expect(splitPlace("Seč").town).toBe("Seč");
    expect(splitPlace("Salzburg").town).toBe("Salzburg");
    expect(splitPlace("Berlin").town).toBe("Berlin");
  });
});
