import { describe, expect, it } from "vitest";
import { findIcsLinks, hasTribeEvents, parseIcsEvents, parseTribeEventsJson } from "@/lib/watcher/extractors/generic-feeds";

describe("generic club feeds (ICS + WordPress Tribe Events)", () => {
  it("parses RFC 5545 ICS cycling events, adjusts exclusive all-day DTEND, and skips non-race noise", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:race-1@club.cz",
      "SUMMARY:Jihočeský MTB maraton 2027",
      "DTSTART;VALUE=DATE:20270515",
      "DTEND;VALUE=DATE:20270516",
      "LOCATION:Český Krumlov",
      "URL:https://club.cz/mtb-2027",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:weekend-2@club.cz",
      "SUMMARY:Silniční dvoudenní závod",
      "DTSTART;VALUE=DATE:20270612",
      "DTEND;VALUE=DATE:20270614",
      "LOCATION:Plzeň",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:noise-3@club.cz",
      "SUMMARY:Výroční členská schůze",
      "DTSTART;VALUE=DATE:20270120",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents("https://club.cz/kalendar.ics", ics);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: "Jihočeský MTB maraton 2027",
      startDate: "2027-05-15",
      endDate: undefined,
      placeText: "Český Krumlov",
      countryHint: "CZ",
      discipline: ["xcm"],
      websiteUrl: "https://club.cz/mtb-2027",
    });
    expect(events[1]).toMatchObject({
      name: "Silniční dvoudenní závod",
      startDate: "2027-06-12",
      endDate: "2027-06-13",
      discipline: ["road"],
    });
  });

  it("parses WordPress The Events Calendar JSON API events", () => {
    const payload = {
      events: [
        {
          id: 42,
          title: "Gravel Jeseníky 2027",
          url: "https://klub.cz/akce/gravel-jeseniky-2027/",
          start_date: "2027-07-10 09:00:00",
          end_date: "2027-07-10 17:00:00",
          venue: { venue: "Areál Kouty", city: "Loučná nad Desnou", geo_lat: 50.099, geo_lng: 17.12 },
          categories: [{ name: "Gravel" }],
        },
        {
          id: 43,
          title: "Brigáda na trati",
          start_date: "2027-04-02 09:00:00",
        },
      ],
    };
    const events = parseTribeEventsJson("https://klub.cz/wp-json/tribe/events/v1/events", payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      externalId: "tribe-42-2027-07-10",
      name: "Gravel Jeseníky 2027",
      startDate: "2027-07-10",
      endDate: undefined,
      placeText: "Areál Kouty, Loučná nad Desnou",
      countryHint: "CZ",
      lat: 50.099,
      lng: 17.12,
      discipline: ["gravel"],
    });
  });

  it("detects ICS links and Tribe Events markers in HTML", () => {
    const html = `<html><head><link rel="alternate" type="text/calendar" href="/events/?ical=1"></head><body class="tribe-events"></body></html>`;
    expect(hasTribeEvents(html)).toBe(true);
    expect(findIcsLinks("https://klub.cz/kalendar/", html)).toEqual(["https://klub.cz/events/?ical=1"]);
  });
});
