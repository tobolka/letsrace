import { describe, expect, it } from "vitest";
import type { EventListItem } from "@/lib/events";
import { catalogueCovers, filterCatalogue } from "@/lib/filter-catalogue";

function race(patch: Partial<EventListItem> & Pick<EventListItem, "id" | "slug" | "startDate">): EventListItem {
  return {
    name: patch.slug,
    endDate: null,
    disciplines: [],
    formats: [],
    audience: "all",
    ageCategories: [],
    ageConfidence: null,
    status: "scheduled",
    visibility: "public",
    eventType: "race",
    competitionType: "individual",
    season: null,
    websiteUrl: null,
    registrationUrl: null,
    regulationsUrl: null,
    resultsUrl: null,
    listingUrl: null,
    sourceKind: "manual",
    level: "local",
    classLabel: null,
    uciClass: null,
    lastSeenAt: null,
    location: { id: "l", name: "Town", municipality: "Town", countryCode: "CZ", lat: 50, lng: 14 },
    series: null,
    ...patch,
  };
}

describe("filterCatalogue", () => {
  const events = [
    race({ id: "1", slug: "a", startDate: "2026-10-24", disciplines: ["gravel"] }),
    race({
      id: "2",
      slug: "b",
      startDate: "2026-11-02",
      location: { id: "l2", name: "Berlin", municipality: "Berlin", countryCode: "DE", lat: 52.5, lng: 13.4 },
    }),
  ];

  it("keeps the weekend inside the box and the country", () => {
    const rows = filterCatalogue(events, {
      categories: [],
      disciplines: ["gravel"],
      levels: [],
      country: ["CZ"],
      dateFrom: "2026-10-24",
      dateTo: "2026-10-25",
      west: 12,
      south: 49,
      east: 16,
      north: 51,
    });
    expect(rows.map((r) => r.slug)).toEqual(["a"]);
  });

  it("does not pretend the shared feed contains last month", () => {
    expect(catalogueCovers("2026-10-01", "2026-10-22")).toBe(false);
    expect(catalogueCovers("2026-10-24", "2026-10-22")).toBe(true);
    expect(catalogueCovers("", "2026-10-22")).toBe(false);
  });
});
