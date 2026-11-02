import { describe, expect, it } from "vitest";
import type { EventListItem } from "@/lib/events";
import { boxAround, pickNearbyRaces, sharesRiders } from "@/lib/nearby-races";

let n = 0;
function race(over: Partial<EventListItem> & { lat?: number; lng?: number } = {}): EventListItem {
  const { lat = 50, lng = 14, ...rest } = over;
  n += 1;
  return {
    id: `r${n}`,
    slug: `race-${n}`,
    name: `Race ${n}`,
    startDate: "2027-05-01",
    endDate: null,
    disciplines: ["xco"],
    formats: [],
    audience: "mixed",
    ageCategories: [],
    ageConfidence: null,
    status: "scheduled",
    visibility: "public",
    eventType: "race",
    competitionType: "race",
    season: null,
    websiteUrl: null,
    registrationUrl: null,
    regulationsUrl: null,
    resultsUrl: null,
    listingUrl: null,
    sourceKind: "official",
    level: "amateur",
    classLabel: null,
    uciClass: null,
    lastSeenAt: null,
    location: { id: `l${n}`, name: "Place", municipality: "Place", countryCode: "CZ", lat, lng },
    series: null,
    ...rest,
  };
}

const today = "2027-01-01";

describe("pickNearbyRaces", () => {
  it("prefers the same kind of racing for the same riders, soonest first", () => {
    const here = race({ ageCategories: ["u9"] });
    const kidsMtb = race({ startDate: "2027-06-01", ageCategories: ["kids"], lat: 50.1 });
    const adultMtb = race({ startDate: "2027-04-01", ageCategories: ["elite"], lat: 50.1 });
    const otherKidsMtb = race({ startDate: "2027-03-01", ageCategories: ["u11"], lat: 50.2 });
    const road = race({ startDate: "2027-02-01", disciplines: ["road"], lat: 50.05 });
    const picked = pickNearbyRaces(here, [here, kidsMtb, adultMtb, otherKidsMtb, road], today, 2);
    expect(picked.map((p) => p.event.id)).toEqual([otherKidsMtb.id, kidsMtb.id]);
    expect(picked[0]!.km).toBeGreaterThan(20);
  });

  it("fills with other kinds only when too few similar races are near", () => {
    const here = race();
    const mtb = race({ lat: 50.1 });
    const road = race({ disciplines: ["road"], lat: 50.1 });
    const picked = pickNearbyRaces(here, [mtb, road], today);
    expect(picked.map((p) => p.event.id).sort()).toEqual([mtb.id, road.id].sort());
  });

  it("leaves out the race itself, its series, far, past and cancelled races", () => {
    const series = { id: "s1", name: "Cup", slug: "cup" };
    const here = race({ series });
    const candidates = [
      here,
      race({ series, lat: 50.1 }),
      race({ lat: 52 }),
      race({ startDate: "2026-12-01", lat: 50.1 }),
      race({ status: "cancelled", lat: 50.1 }),
    ];
    expect(pickNearbyRaces(here, candidates, today)).toEqual([]);
  });

  it("gives nothing for a race without coordinates", () => {
    expect(pickNearbyRaces(race({ location: null }), [race()], today)).toEqual([]);
  });
});

describe("sharesRiders", () => {
  it("matches age groups, and falls back to audience", () => {
    expect(sharesRiders(race({ ageCategories: ["u9"] }), race({ ageCategories: ["kids"] }))).toBe(true);
    expect(sharesRiders(race({ ageCategories: ["u9"] }), race({ ageCategories: ["masters"] }))).toBe(false);
    expect(sharesRiders(race({ audience: "kids" }), race({ audience: "adults" }))).toBe(false);
    expect(sharesRiders(race({ audience: "kids" }), race({ audience: "mixed" }))).toBe(true);
  });
});

describe("boxAround", () => {
  it("holds the circle", () => {
    const box = boxAround(50, 14, 75);
    expect(box.north - 50).toBeCloseTo(0.676, 2);
    expect(box.east - 14).toBeGreaterThan(box.north - 50);
  });
});
