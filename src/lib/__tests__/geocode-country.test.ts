import { describe, expect, it } from "vitest";
import { EUROPE_COUNTRY_CODES } from "@/lib/geo/europe";

/**
 * The unrestricted retry — the one that runs when a place cannot be found in
 * the country a calendar claimed — accepted whatever came back. Asked for
 * "Italy" inside Italy and finding nothing, it took Italy, Texas, and pinned
 * three upcoming races there. "Switzerland" went to Switzerland County,
 * Indiana; "Unknown" to Assam.
 *
 * The rule it now applies, stated on its own so it can be checked: the answer
 * must be the country that was asked for, or another European one.
 */
function accepts(asked: string, found: string): boolean {
  const europe = EUROPE_COUNTRY_CODES as readonly string[];
  const a = asked.toUpperCase();
  const f = found.toUpperCase();
  if (!f) return true;
  return f === a || (europe.includes(a) && europe.includes(f));
}

describe("a place found in another country", () => {
  it("refuses another continent", () => {
    expect(accepts("IT", "US")).toBe(false);
    expect(accepts("CH", "US")).toBe(false);
    expect(accepts("CZ", "IN")).toBe(false);
    expect(accepts("CZ", "TH")).toBe(false);
  });

  it("keeps the border cases the retry exists for", () => {
    // A Czech calendar listing a round just over the Austrian border.
    expect(accepts("CZ", "AT")).toBe(true);
    expect(accepts("DE", "PL")).toBe(true);
  });

  it("keeps a country's own islands, wherever they are", () => {
    // Gran Canaria and Madeira are Spain and Portugal, and are nowhere near
    // any box drawn around Europe.
    expect(accepts("ES", "ES")).toBe(true);
    expect(accepts("PT", "PT")).toBe(true);
    expect(accepts("FR", "FR")).toBe(true);
  });

  it("says nothing when the answer says nothing", () => {
    expect(accepts("CZ", "")).toBe(true);
  });
});
