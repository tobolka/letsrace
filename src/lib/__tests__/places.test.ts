import { describe, expect, it } from "vitest";
import { formatPlaceName } from "@/lib/places";

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
