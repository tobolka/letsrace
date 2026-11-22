import { describe, expect, it } from "vitest";
import { buildDetailModel } from "@/components/explore/event-detail-model";
import { practicalProgramme } from "@/lib/catalog/practical-programme";
import type { EventListItem } from "@/lib/events";
import { gpsFromText } from "@/lib/gps-text";
import { messagesFor } from "@/lib/i18n/messages";
import { buildRaceLinks, raceDestination } from "@/lib/race-links";
import { venueCoordinatesFromDocument } from "@/lib/catalog/venue-coordinates";

describe("gpsFromText", () => {
  it("reads the organiser's coordinates in the usual written forms", () => {
    expect(gpsFromText("Areál RAC Sedlčany, (GPS: 49.6689169N, 14.4300139E)")).toEqual({ lat: 49.6689169, lng: 14.4300139 });
    expect(gpsFromText("49.6689° N 14.4300° E")).toEqual({ lat: 49.6689, lng: 14.43 });
    expect(gpsFromText("N 49,6689 E 14,4300")).toEqual({ lat: 49.6689, lng: 14.43 });
    expect(gpsFromText("GPS: 49.6689, 14.4300")).toEqual({ lat: 49.6689, lng: 14.43 });
    const dms = gpsFromText("49°40'08.1\"N 14°25'48.1\"E");
    expect(dms?.lat).toBeCloseTo(49.66892, 4);
    expect(dms?.lng).toBeCloseTo(14.43003, 4);
  });
  it("ignores numbers that are not a place", () => {
    expect(gpsFromText("Startovné 350.000 Kč, 14.30 hod")).toBeNull();
    expect(gpsFromText("GPS: 149.6689, 214.4300")).toBeNull();
    expect(gpsFromText("Místo konání: Sedlčany")).toBeNull();
  });
});

describe("the venue's coordinates from the regulations", () => {
  const doc = {
    url: "https://club.test/zavody/cyklokros/",
    links: [] as string[],
    text: [
      "ŽABÁCKÝ CYKLOKROS – Memoriál",
      "Termín konání: 22. listopadu 2026, neděle",
      "Pořadatel: Klub DA-BA, zapsaný spolek",
      "Místo konání: Areál RAC Sedlčany, Sedlčany – Sedlčanská Kotlina, (GPS: 49.6689169N, 14.4300139E)",
    ].join("\n"),
  };
  const context = { name: "Žabácký cyklokros 2026 – Memoriál", startDate: "2026-11-22" };
  it("are kept with the venue when the quoted line gives them, and the name stays clean", () => {
    const venue = practicalProgramme(doc, context).venue?.value;
    expect(venue).toMatchObject({ name: "Areál RAC Sedlčany, Sedlčany – Sedlčanská Kotlina", lat: 49.6689169, lng: 14.4300139 });
  });
  it("are left out when the line has none", () => {
    const plain = { ...doc, text: doc.text.replace(", (GPS: 49.6689169N, 14.4300139E)", "") };
    const venue = practicalProgramme(plain, context).venue?.value;
    expect(venue?.name).toContain("Areál RAC Sedlčany");
    expect(venue?.lat).toBeUndefined();
  });
});

const venueFact = (status: "current" | "year_neutral" | "inherited") => ({
  venue: { sourceUrl: "https://club.test/", quote: "Místo konání: Areál (GPS: 49.6689N, 14.4300E)", checkedAt: "2026-11-22T06:00:00.000Z", editionYear: 2026, status, value: { name: "Areál", precision: "venue" as const, lat: 49.6689, lng: 14.43 } },
});
const town = { lat: 49.66179, lng: 14.554793 };

describe("raceDestination", () => {
  it("is the venue the regulations give, not the town's geocode", () => {
    expect(raceDestination({ location: town, practicalDetails: venueFact("current") })).toEqual({ lat: 49.6689, lng: 14.43, fromVenue: true });
    expect(raceDestination({ location: town, practicalDetails: venueFact("year_neutral") })?.fromVenue).toBe(true);
  });
  it("falls back to the place when there is no venue, or only last year's", () => {
    expect(raceDestination({ location: town, practicalDetails: {} })).toEqual({ ...town, fromVenue: false });
    expect(raceDestination({ location: town, practicalDetails: venueFact("inherited") })?.fromVenue).toBe(false);
    expect(raceDestination({ location: { lat: null, lng: null } })).toBeNull();
  });
  it("sends the directions to the venue", () => {
    const event = { id: "1", slug: "r", name: "R", startDate: "2026-11-22", endDate: null, disciplines: ["cx"], ageCategories: [], level: "local", location: { id: "l", name: "Sedlčany", municipality: "Sedlčany", countryCode: "CZ", ...town }, practicalDetails: venueFact("current") } as unknown as EventListItem;
    expect(buildDetailModel(event, "cs", messagesFor("cs")).directionsUrl).toContain("destination=49.6689%2C14.43");
  });
});

describe("buildRaceLinks", () => {
  const race = {
    id: "1", slug: "r", name: "R", startDate: "2026-11-22",
    websiteUrl: "https://series.test/r", registrationUrl: "https://signup.test/1", regulationsUrl: "https://club.test/propozice",
    resultsUrl: "https://signup.test/", facebookUrl: "https://www.facebook.com/series", listingUrl: "https://cal.test/r",
    series: { name: "TBC série", slug: "tbc" },
  } as unknown as EventListItem;
  const names = (links: { label: string }[]) => links.map((l) => l.label);
  it("lists the organiser's pages in one order under one set of names", () => {
    const links = buildRaceLinks(race, "en", { forecast: { href: "https://windy.test/", label: "Weather forecast" } });
    expect(names(links)).toEqual(["Race website", "Registration", "Regulations", "Results", "Facebook", "TBC série", "Weather forecast"]);
    expect(links.find((l) => l.kind === "series")).toMatchObject({ external: false, href: "/en/series/tbc" });
  });
  it("names the regulations alike in every language the page does", () => {
    expect(names(buildRaceLinks(race, "cs"))).toContain("Propozice");
  });
  it("puts the regulations' other documents before the series and the forecast, and each address once", () => {
    const documents = { sourceUrl: "https://club.test/", quote: "Organizační pokyny", checkedAt: "2026-11-22T06:00:00.000Z", editionYear: 2026, status: "current" as const, value: [{ kind: "instructions" as const, url: "https://club.test/pokyny.pdf" }, { kind: "regulations" as const, url: "https://club.test/propozice" }] };
    const links = buildRaceLinks(race, "en", { documents });
    expect(links.map((l) => l.kind)).toEqual(["website", "register", "regulations", "results", "facebook", "instructions", "series"]);
  });
  it("offers the calendar listing only when there is no site and no entry form", () => {
    expect(buildRaceLinks({ ...race, websiteUrl: null, registrationUrl: null } as EventListItem, "en").map((l) => l.kind)).toContain("listing");
    expect(buildRaceLinks(race, "en").map((l) => l.kind)).not.toContain("listing");
  });
});

describe("venueCoordinatesFromDocument", () => {
  const text = ["Date & Place 22.11.2026, X-BIONIC Sphere, Dubová 33, Šamorín", "GPS: 48.0159, 17.3013", "", "Parking: 48.1000, 17.4000 behind the hall", "", "", "", "Finish: 48.2000, 17.5000"].join("\n");
  it("takes the coordinates beside the venue and widens the quote to the passage that holds both", () => {
    const hit = venueCoordinatesFromDocument(text, "Date & Place 22.11.2026, X-BIONIC Sphere, Dubová 33, Šamorín");
    expect(hit?.point).toEqual({ lat: 48.0159, lng: 17.3013 });
    expect(hit?.quote).toBe("Date & Place 22.11.2026, X-BIONIC Sphere, Dubová 33, Šamorín\nGPS: 48.0159, 17.3013");
  });
  it("does not take a coordinate from further away, or when the venue is not in the document", () => {
    expect(venueCoordinatesFromDocument(["Venue: Hall", "x", "y", "z", "GPS: 48.2000, 17.5000"].join("\n"), "Venue: Hall")).toBeNull();
    expect(venueCoordinatesFromDocument(text, "Somewhere else entirely")).toBeNull();
  });
});
