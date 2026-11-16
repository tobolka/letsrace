import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractWithAdapter, isWholeCalendarHost } from "@/lib/watcher/extractors/adapters";
import { parseEndureEvents } from "@/lib/watcher/extractors/endure";

const body = readFileSync(join(__dirname, "fixtures/endure-events-2027.json"), "utf8");
const byName = (name: string) => parseEndureEvents(body).find((e) => e.name.includes(name));

describe("ENDURE events calendar", () => {
  it("keeps confirmed cycling editions and drops triathlons and unconfirmed dates", () => {
    const names = parseEndureEvents(body).map((e) => e.name);
    expect(names).not.toContain("3Rides Gran Fondo Südliche Weinstraße");
    expect(names.some((n) => /triathlon/i.test(n))).toBe(false);
    expect(names).toContain("24h Radmarathon Grieskirchen");
  });

  it("reads date, place, coordinates and the organiser's own links", () => {
    const race = byName("Grieskirchen")!;
    expect(race).toMatchObject({
      externalId: "endure-24h-radmarathon-grieskirchen-2027",
      startDate: "2027-07-10",
      endDate: "2027-07-11",
      countryHint: "AT",
      placeText: "Grieskirchen, Oberösterreich",
      websiteUrl: "http://rmg.rc-grieskirchen.at/",
      sourceUrl: "https://events.endure-cycling.com/events/24h-radmarathon-grieskirchen-2027/",
      discipline: ["road", "gran_fondo"],
    });
    expect(race.eventType).toBeUndefined();
    expect(race.lat).toBeCloseTo(48.23, 1);
  });

  it("lists an RTF and a German touring Radmarathon as rides, a Jedermannrennen as a race", () => {
    expect(byName("Chiemgau")!.eventType).toBe("ride");
    const touring = byName("Mecklenburger")!;
    expect(touring.eventType).toBe("ride");
    expect(touring.sourceWarnings?.length).toBe(1);
    expect(byName("Jedermann")!.eventType).toBeUndefined();
  });

  it("files a mountain-bike stage race under MTB, not road", () => {
    expect(byName("Alpentour")!.discipline).toEqual(["mtb", "xcm"]);
  });

  it("reads only the data file and treats the host as one whole calendar", async () => {
    const host = "events.endure-cycling.com";
    expect(isWholeCalendarHost(host)).toBe(true);
    expect((await extractWithAdapter(host, "https://events.endure-cycling.com/events.json", body))?.strategy).toBe("adapter:endure");
    expect(await extractWithAdapter(host, "https://events.endure-cycling.com/radrennen/deutschland/2027/", "<html></html>")).toEqual({ events: [], strategy: "adapter:endure-skip" });
  });
});
