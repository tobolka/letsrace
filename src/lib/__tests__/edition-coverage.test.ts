import { describe, expect, it } from "vitest";
import { computeEditionCoverage, mergeEditionCoverageHistory } from "@/lib/catalog/edition-coverage";
import type { EditionIdentity } from "@/lib/catalog/edition-identity";

const race = (
  id: string,
  name: string,
  start_date: string,
  country_code: string,
  extra: Partial<EditionIdentity> = {},
): EditionIdentity => ({
  id,
  name,
  start_date,
  series_id: null,
  disciplines: ["mtb"],
  location: { lat: 50, lng: 14, country_code, municipality: "Beroun" },
  ...extra,
});

describe("computeEditionCoverage", () => {
  it("counts previous-year races that have a matching public next edition, grouped by country", () => {
    const previous = [
      race("p1", "Bikemaraton Beroun 2026", "2026-04-25", "CZ"),
      race("p2", "Mladá Boleslav Tour 2026", "2026-05-16", "CZ", { location: { lat: 50.4, lng: 14.9, country_code: "CZ", municipality: "Mladá Boleslav" } }),
      race("p3", "Alpen Marathon 2026", "2026-06-10", "AT", { location: { lat: 47.3, lng: 11.4, country_code: "AT", municipality: "Innsbruck" } }),
      race("p4", "Outside Scope Race 2026", "2026-06-12", "FR", { location: { lat: 48.8, lng: 2.3, country_code: "FR", municipality: "Paris" } }),
    ];
    const upcoming = [
      race("u1", "Bikemaraton Beroun 2027", "2027-04-24", "CZ"),
      race("u2", "Alpen Marathon 2027", "2027-06-12", "AT", { location: { lat: 47.3, lng: 11.4, country_code: "AT", municipality: "Innsbruck" } }),
    ];

    const result = computeEditionCoverage(previous, upcoming, 2027, ["CZ", "AT"]);
    expect(result).toEqual({
      season: 2027,
      races: 3,
      withEdition: 2,
      publicRaces: 2,
      byCountry: {
        CZ: { races: 2, withEdition: 1, publicRaces: 1 },
        AT: { races: 1, withEdition: 1, publicRaces: 1 },
      },
    });
  });

  it("matches renamed editions via shared series_id and venue", () => {
    const previous = [race("p1", "KPZ Beroun 2026", "2026-04-25", "CZ", { series_id: "kpz" })];
    const upcoming = [race("u1", "Bikemaraton Beroun", "2027-04-24", "CZ", { series_id: "kpz" })];
    expect(computeEditionCoverage(previous, upcoming, 2027, ["CZ"]).withEdition).toBe(1);
  });
});

describe("mergeEditionCoverageHistory", () => {
  it("replaces an existing entry for the same day and keeps the tail bounded", () => {
    const history = mergeEditionCoverageHistory(
      [
        { day: "2026-11-23", races: 3843, withEdition: 255 },
        { day: "2026-11-24", races: 3843, withEdition: 259 },
      ],
      { races: 3843, withEdition: 270 },
      "2026-11-24",
    );
    expect(history).toEqual([
      { day: "2026-11-23", races: 3843, withEdition: 255 },
      { day: "2026-11-24", races: 3843, withEdition: 270 },
    ]);
  });
});
