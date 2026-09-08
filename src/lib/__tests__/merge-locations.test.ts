import { describe, expect, it } from "vitest";
import {
  foldPlace,
  groupMergeable,
  isCountryOnlyPlace,
  pickSurvivor,
  type LocationRow,
} from "@/lib/catalog/merge-locations";

function row(over: Partial<LocationRow> & { id: string }): LocationRow {
  return {
    name: null,
    municipality: null,
    region: null,
    venue: null,
    country_code: "CZ",
    lat: 50.0,
    lng: 14.0,
    geocode_status: "ok",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("isCountryOnlyPlace", () => {
  // Forty-nine British races sat on one point near Penrith, which is the
  // centre of the United Kingdom and the venue of none of them.
  it("knows a country is not a venue", () => {
    for (const place of [
      "United Kingdom",
      "France",
      "Austria",
      "Österreich",
      "Italia",
      "Czechia",
      "Česká republika",
      "Spain",
      "España",
      "Polska",
      "Scotland",
    ]) {
      expect(isCountryOnlyPlace(place), place).toBe(true);
    }
  });

  it("keeps the pin in a state small enough to be its own venue", () => {
    // Monaco is two square kilometres — the country centroid is the venue.
    expect(isCountryOnlyPlace("Monaco", "MC")).toBe(false);
    expect(isCountryOnlyPlace("Gibraltar", "GI")).toBe(false);
    expect(isCountryOnlyPlace("Monaco", "FR")).toBe(true);
  });

  it("leaves real places alone", () => {
    for (const place of [
      "Girona",
      "Praha",
      "Nové Město na Moravě",
      "Fort William",
      "Bad Goisern",
      "Les Gets",
      "Frankfurt",
      "",
      null,
    ]) {
      expect(isCountryOnlyPlace(place), String(place)).toBe(false);
    }
  });
});

describe("foldPlace", () => {
  it("folds spelling, case and punctuation to one key", () => {
    expect(foldPlace("GIRONA, Spain")).toBe(foldPlace("Girona, Spain"));
    expect(foldPlace("Nové Město Na Moravě")).toBe(foldPlace("nove mesto na morave"));
    expect(foldPlace("Girona")).not.toBe(foldPlace("Gerona"));
  });
});

describe("pickSurvivor", () => {
  it("keeps the resolved, properly written row", () => {
    const shouting = row({ id: "a", municipality: "MLADÁ BOLESLAV" });
    const proper = row({ id: "b", municipality: "Mladá Boleslav" });
    expect(pickSurvivor([shouting, proper]).id).toBe("b");
  });

  it("prefers a geocoded row over an unresolved one", () => {
    const pending = row({ id: "a", municipality: "Girona", geocode_status: "pending" });
    const resolved = row({ id: "b", municipality: "Girona", geocode_status: "ok" });
    expect(pickSurvivor([pending, resolved]).id).toBe("b");
  });

  it("breaks a tie on age, so the choice does not move between runs", () => {
    const older = row({ id: "z", municipality: "Girona", created_at: "2025-01-01T00:00:00Z" });
    const newer = row({ id: "a", municipality: "Girona", created_at: "2026-01-01T00:00:00Z" });
    expect(pickSurvivor([newer, older]).id).toBe("z");
    expect(pickSurvivor([older, newer]).id).toBe("z");
  });
});

describe("groupMergeable", () => {
  it("merges spellings of one town", () => {
    const rows = [
      row({ id: "a", municipality: "Girona" }),
      row({ id: "b", municipality: "GIRONA" }),
      row({ id: "c", municipality: "girona" }),
    ];
    const groups = groupMergeable(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.duplicates).toHaveLength(2);
  });

  it("leaves two different towns on one point alone", () => {
    // Všetaty is 30 km from Prague and was geocoded onto it. Merging the two
    // would state that they are the same place.
    const rows = [
      row({ id: "a", municipality: "Praha" }),
      row({ id: "b", municipality: "Všetaty" }),
    ];
    expect(groupMergeable(rows)).toHaveLength(0);
  });

  it("will not merge across a border, however equal the point", () => {
    const rows = [
      row({ id: "a", municipality: "Austria", country_code: "AT" }),
      row({ id: "b", municipality: "Austria", country_code: "DE" }),
    ];
    expect(groupMergeable(rows)).toHaveLength(0);
  });

  it("ignores rows with no coordinate and rows with no place", () => {
    const rows = [
      row({ id: "a", municipality: "Girona", lat: null, lng: null }),
      row({ id: "b", municipality: "Girona" }),
      row({ id: "c", municipality: "  " }),
    ];
    expect(groupMergeable(rows)).toHaveLength(0);
  });
});
