import { describe, expect, it } from "vitest";
import fixture from "./fixtures/uci-80678.json";
import { parseUciCompetition, uciDateSpan } from "@/lib/watcher/extractors/uci-competition";
import { extractJsonLdEvents } from "@/lib/watcher/extractors/jsonld";
import { disciplinesFromCsv } from "@/lib/catalog/csv-series-meta";
import { canReconcileMissingEvents, extractEvents } from "@/lib/watcher/core";
import { canonicalizeDiscipline, DISCIPLINE_TREE, formatsFromDisciplines, inferDisciplines, matchesDisciplineFilter } from "@/lib/taxonomy";

const url = "https://www.uci.org/competition-details/2027/MTB/80678";
const html = `<div data-props='${JSON.stringify(fixture).replaceAll("'", "&#39;")}'></div>`;
describe("UCI competition evidence and four-cross", () => {
  it("uses the same official parser in the running collector", async () => {
    const result = await extractEvents(url, html);
    expect(result.strategy).toBe("adapter:uci-competition");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].uciClass).toBe("c3");
  });
  it("reads the actual UCI component without guessing from the old organiser page", () => {
    const [event] = parseUciCompetition(url, html);
    expect(event).toMatchObject({ externalId: "uci-MTB-80678-2027", startDate: "2027-07-09", endDate: "2027-07-10", countryHint: "CZ", placeText: "Jablonec nad Nisou", discipline: ["four_cross"], uciClass: "c3" });
    expect(event.categories?.map(c => c.name)).toEqual(["Men Elite", "Women Elite"]);
    expect(event.registrationUrl).toBeUndefined();
    expect(event.categories?.some(c => /kids/i.test(c.name))).toBe(false);
  });
  it("requires explicit valid dates for the requested edition", () => {
    expect(parseUciCompetition(url.replace("2027", "2028"), html)).toEqual([]);
    expect(parseUciCompetition(url, "<div>No calendar data</div>")).toEqual([]);
    for (const dates of ["31 Feb 2027", "00 Jul 2027", "10 Jul - 09 Jul 2027", "July 2027"]) expect(uciDateSpan(dates, "2027")).toBeNull();
    expect(uciDateSpan("09 Jul 2027", "2027")).toEqual({ start: "2027-07-09", end: "2027-07-09" });
    expect(canReconcileMissingEvents({ events: [], strategy: "adapter:uci-competition", childUrls: [], confidence: 1 })).toBe(false);
  });
  it("offers 4X under MTB and never treats it as BMX or XCO", () => {
    for (const name of ["4X", "Four-Cross", "four cross"]) expect(canonicalizeDiscipline(name)).toBe("four_cross");
    expect(inferDisciplines("4X Pro Tour")).toContain("four_cross");
    expect(formatsFromDisciplines(["four_cross"])).toContain("four_cross");
    expect(disciplinesFromCsv("4X", "Four-Cross")).toEqual(["mtb", "four_cross"]);
    expect(DISCIPLINE_TREE.find(d => d.id === "mtb")?.children?.some(d => d.id === "four_cross")).toBe(true);
    expect(matchesDisciplineFilter(["four_cross"], ["mtb"])).toBe(true);
    expect(matchesDisciplineFilter(["four_cross"], ["bmx"])).toBe(false);
    expect(matchesDisciplineFilter(["four_cross"], ["xco"])).toBe(false);
  });
  it("uses a municipality address rather than a venue label as the town", () => {
    const json = { "@type": "SportsEvent", name: "Road Stage Orlické hory 2027", startDate: "2027-06-05", location: { name: "Kikirikiii", address: { addressLocality: "Deštné v Orlických horách", addressCountry: "CZ" } } };
    const [event] = extractJsonLdEvents("https://www.roadstage.cz/orlicke-hory", `<script type="application/ld+json">${JSON.stringify(json)}</script>`);
    expect(event.placeText).toBe("Deštné v Orlických horách");
    expect(event.countryHint).toBe("CZ");
  });
});
