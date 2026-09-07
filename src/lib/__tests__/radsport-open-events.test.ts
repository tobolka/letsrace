import { describe, expect, it } from "vitest";
import { radsportEventToParsed, type ApiEvent } from "@/lib/watcher/extractors/radsport";

function ev(overrides: Partial<ApiEvent>): ApiEvent {
  return {
    id: 1,
    title: "Rennen",
    eventDate: "2026-06-06",
    city: "Kassel",
    country: "DE",
    category: "ROAD",
    ...overrides,
  } as ApiEvent;
}

/**
 * 123 upcoming German races carried no categories at all, and the API has no
 * category field — but its event type is the organiser saying who may start.
 */
describe("radsport age categories", () => {
  it("reads an open event type as amateur", () => {
    for (const eventType of ["RTF", "CTF", "JEDERMANN", "RADMARATHON", "MTB_MARATHON", "BREVET"]) {
      expect(radsportEventToParsed(ev({ eventType }))?.ageCategories, eventType).toEqual([
        "amateur",
      ]);
    }
  });

  it("says nothing about a licensed race", () => {
    for (const eventType of ["STRASSENRENNEN", "CROSSCOUNTRY", "KRITERIUM", "ENDURO"]) {
      expect(radsportEventToParsed(ev({ eventType }))?.ageCategories, eventType).toBeUndefined();
    }
  });

  it("says nothing when the type is missing", () => {
    expect(radsportEventToParsed(ev({ eventType: null }))?.ageCategories).toBeUndefined();
  });

  it("still marks a tour as a ride rather than a race", () => {
    const parsed = radsportEventToParsed(ev({ eventType: "RTF" }));
    expect(parsed?.eventType).toBe("ride");
    expect(parsed?.ageCategories).toEqual(["amateur"]);
  });
});
