import { describe, expect, it } from "vitest";
import { simplifyPlaceQuery } from "@/lib/geo/simplify-place";

/**
 * Every string here is a row sitting in the catalogue right now with no
 * coordinates, because the place field holds a club, a street or a venue and
 * the geocoder was asked for that instead of a town.
 */
describe("simplifyPlaceQuery", () => {
  it("finds the town inside a club's full name", () => {
    expect(simplifyPlaceQuery("ARBÖ ASKÖ Raiffeisen Radclub Feld am See — Kärnten")).toBe(
      "Feld am See",
    );
    expect(simplifyPlaceQuery("Cycling Team Schwingshandl — Oberösterreich")).toBe(
      "Schwingshandl",
    );
  });

  it("cuts an Italian street or venue off the comune", () => {
    expect(simplifyPlaceQuery("Bolgare Via Manzoni Centro Sportivo Signorelli")).toBe("Bolgare");
    expect(simplifyPlaceQuery("Chiuduno Via Monte Isola 4a")).toBe("Chiuduno");
    expect(simplifyPlaceQuery("Località Corsalone")).toBe("Corsalone");
    expect(simplifyPlaceQuery("BRESCIA/COLLE MADDALENA")).toBe("BRESCIA");
  });

  it("drops the neighbour a Czech village is named after", () => {
    expect(simplifyPlaceQuery("Horní Planá u Lipna")).toBe("Horní Planá");
    expect(simplifyPlaceQuery("Jesnice u Rakovníka")).toBe("Jesnice");
    expect(simplifyPlaceQuery("Nový Dvůr u Hlohovce")).toBe("Nový Dvůr");
  });

  it("takes the town out of a velodrome", () => {
    expect(simplifyPlaceQuery("tor kolarski Pruszków")).toBe("Pruszków");
  });

  it("gives up rather than guess", () => {
    expect(simplifyPlaceQuery("lokalita v jednání")).toBeNull();
    expect(simplifyPlaceQuery("[?]")).toBeNull();
    expect(simplifyPlaceQuery("M")).toBeNull();
    expect(simplifyPlaceQuery("")).toBeNull();
    expect(simplifyPlaceQuery(null)).toBeNull();
  });

  it("returns nothing when there was nothing to simplify", () => {
    // A plain town is already the query; retrying it would only repeat a miss.
    expect(simplifyPlaceQuery("Brno")).toBeNull();
    expect(simplifyPlaceQuery("Hradec Králové")).toBeNull();
  });
});
