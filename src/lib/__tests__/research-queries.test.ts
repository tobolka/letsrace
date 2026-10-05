import { describe, expect, it } from "vitest";
import { researchQueries } from "@/lib/catalog/research-queries";

const race = { name: "Perlcross", municipality: "Perl", startDate: "2026-10-11", country: "DE", website: null, registration: null, regulations: null };
describe("research queries", () => {
  it("searches missing fields in the local language, with a yearless homepage fallback", () => {
    expect(researchQueries(race)).toEqual(["Perlcross Perl 2026", "Perlcross Perl 2026 Ausschreibung", "Perlcross Perl 2026 Anmeldung", "Perlcross Perl"]);
  });
  it("targets known organisers and skips fields already filled", () => {
    expect(researchQueries({ ...race, website: "https://perlcross.de/", registration: "https://entry.test/1" })).toEqual(["Perlcross Perl 2026 Ausschreibung site:perlcross.de"]);
    expect(researchQueries({ ...race, website: "https://perlcross.de/", registration: "entry", regulations: "rules" })).toEqual([]);
  });
});
