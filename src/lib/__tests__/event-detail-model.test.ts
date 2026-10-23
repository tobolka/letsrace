import { describe, expect, it } from "vitest";
import { buildDetailModel, googleDirectionsUrl } from "@/components/explore/event-detail-model";
import type { EventListItem } from "@/lib/events";
import { messagesFor } from "@/lib/i18n/messages";

const t = messagesFor("cs");
const event = {
  id: "1", slug: "r", name: "R", startDate: "2026-11-01", endDate: null, disciplines: ["cx", "road", "mtb", "gravel", "bmx"],
  ageCategories: [], ageConfidence: "default", level: "local", classLabel: null, uciClass: null, lastSeenAt: null,
  websiteUrl: null, registrationUrl: null, regulationsUrl: null, resultsUrl: null, listingUrl: null,
  location: { id: "l", name: "Brno hall", municipality: "Brno", countryCode: "CZ", lat: null, lng: null },
  series: null, sourceKind: "official",
} as unknown as EventListItem;
const build = (over: Partial<EventListItem>) => buildDetailModel({ ...event, ...over }, "cs", t);

describe("googleDirectionsUrl", () => {
  it("prefers coordinates, falls back to the place name, else nothing", () => {
    expect(googleDirectionsUrl({ lat: 49.2, lng: 16.6 }, "Brno")).toContain("destination=49.2%2C16.6");
    expect(googleDirectionsUrl({ lat: null, lng: null }, " Brno · CZ ")).toContain("destination=Brno%20%C2%B7%20CZ");
    expect(googleDirectionsUrl(null, "  ")).toBeNull();
  });
});

describe("buildDetailModel", () => {
  it("shows at most four discipline chips", () => expect(build({}).discChips).toHaveLength(4));

  it("names the place by municipality then country", () => expect(build({}).placeLabel).toBe("Brno · CZ"));

  it("leads with registration, then lists the other pages once each", () => {
    const m = build({
      registrationUrl: "https://reg", websiteUrl: "https://web", regulationsUrl: "https://web", resultsUrl: "https://res",
    });
    expect(m.actionLinks.map((l) => [l.kind, l.href])).toEqual([
      ["register", "https://reg"], ["website", "https://web"], ["results", "https://res"],
    ]);
  });

  it("falls back to regulations as the way in when nothing else exists", () => {
    const m = build({ regulationsUrl: "https://r.pdf" });
    expect(m.primary).toMatchObject({ kind: "regulations", href: "https://r.pdf" });
  });

  it("has no primary link for a race with no online page", () => {
    const m = build({});
    expect(m.primary).toBeNull();
    expect(m.actionLinks).toEqual([]);
  });

  it("ignores a listing page that repeats the website", () => {
    const m = build({ websiteUrl: "https://w", listingUrl: "https://w" });
    expect(m.actionLinks).toHaveLength(1);
  });
});
