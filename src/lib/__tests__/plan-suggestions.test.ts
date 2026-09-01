import { describe, expect, it } from "vitest";
import { rankSuggestions, type SuggestionCandidate, type SuggestionContext } from "@/lib/plan-suggestions";

const PRAGUE = { lat: 50.0755, lng: 14.4378 };

const race = (over: Partial<SuggestionCandidate> & { id: string }): SuggestionCandidate => ({
  name: over.id, slug: over.id, startDate: "2026-09-12", endDate: null,
  seriesId: null, seriesName: null, disciplines: ["mtb"],
  place: null, countryCode: "CZ", lat: PRAGUE.lat, lng: PRAGUE.lng,
  ...over,
});

const ctx = (over: Partial<SuggestionContext> = {}): SuggestionContext => ({
  home: PRAGUE,
  radiusKm: 50,
  riddenSeriesIds: new Set(),
  riddenDisciplines: new Set(["mtb"]),
  plannedEventIds: new Set(),
  ...over,
});

describe("rankSuggestions", () => {
  it("puts the next round of a series they ride above anything closer", () => {
    const out = rankSuggestions(
      [
        race({ id: "close", lat: 50.08, lng: 14.44 }),
        race({ id: "series-round", seriesId: "s1", lat: 49.5, lng: 15.5 }),
      ],
      ctx({ riddenSeriesIds: new Set(["s1"]) }),
    );
    expect(out.map((s) => s.id)).toEqual(["series-round", "close"]);
    expect(out[0]!.reason).toBe("series");
  });

  it("orders the rest by how far it is to drive", () => {
    const out = rankSuggestions(
      [
        race({ id: "far", lat: 49.6, lng: 15.4 }),
        race({ id: "near", lat: 50.1, lng: 14.5 }),
        race({ id: "mid", lat: 50.4, lng: 14.9 }),
      ],
      ctx(),
    );
    expect(out.map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("never suggests a race already in the plan", () => {
    const out = rankSuggestions(
      [race({ id: "planned" }), race({ id: "new" })],
      ctx({ plannedEventIds: new Set(["planned"]) }),
    );
    expect(out.map((s) => s.id)).toEqual(["new"]);
  });

  it("drops races too far to be a morning out, series or not", () => {
    const out = rankSuggestions(
      [race({ id: "romania", seriesId: "s1", lat: 46.06, lng: 23.56 })],
      ctx({ riddenSeriesIds: new Set(["s1"]) }),
    );
    expect(out).toEqual([]);
  });

  it("prefers a discipline they actually race", () => {
    const out = rankSuggestions(
      [
        race({ id: "road", disciplines: ["road"], lat: 50.08, lng: 14.44 }),
        race({ id: "mtb", disciplines: ["mtb"], lat: 50.3, lng: 14.8 }),
      ],
      ctx({ riddenDisciplines: new Set(["mtb"]) }),
    );
    expect(out[0]!.id).toBe("mtb");
  });

  it("labels why each one is there", () => {
    const out = rankSuggestions(
      [
        race({ id: "s", seriesId: "s1" }),
        race({ id: "n", lat: 50.1, lng: 14.5 }),
        race({ id: "d", lat: 50.9, lng: 15.4 }),
      ],
      ctx({ riddenSeriesIds: new Set(["s1"]) }),
    );
    expect(out.map((s) => s.reason)).toEqual(["series", "nearby", "discipline"]);
  });

  it("still works for someone with no location set", () => {
    const out = rankSuggestions([race({ id: "a" }), race({ id: "b" })], ctx({ home: null }));
    expect(out).toHaveLength(2);
    expect(out[0]!.distanceKm).toBeNull();
  });
});
