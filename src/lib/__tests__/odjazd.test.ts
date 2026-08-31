import { describe, expect, it } from "vitest";
import { eventName, listItems, toStub, upcomingWeeks } from "@/lib/watcher/extractors/odjazd";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

const item = (over: Record<string, unknown> = {}) => ({
  "@type": "SportsEvent",
  name: "Rower · GRAVEL",
  url: "https://odjazd.pl/wydarzenie/b6a323b5-8b94-2c24-0036-bb8f2e8930dd",
  startDate: "2026-09-11",
  endDate: "2026-09-11",
  sport: "Rower",
  location: {
    "@type": "Place",
    name: "Funka",
    address: { addressLocality: "Funka", addressCountry: "PL", addressRegion: "pomorskie" },
  },
  ...over,
});

describe("listItems", () => {
  it("reads the week's ItemList and ignores other structured data", () => {
    const html =
      ld({ "@type": "Organization", name: "odjazd.pl" }) +
      ld({ "@type": "ItemList", itemListElement: [{ item: item() }, { item: item() }] });
    expect(listItems(html)).toHaveLength(2);
  });

  it("survives a malformed block", () => {
    expect(listItems(`<script type="application/ld+json">{oops</script>`)).toEqual([]);
  });
});

describe("toStub", () => {
  it("reads a cycling entry", () => {
    expect(toStub(item())).toMatchObject({
      externalId: "odjazd-b6a323b5-8b94-2c24-0036-bb8f2e8930dd",
      startDate: "2026-09-11",
      endDate: undefined,
      placeText: "Funka",
      countryHint: "PL",
      discipline: ["gravel"],
    });
  });

  it("keeps only cycling", () => {
    expect(toStub(item({ sport: "Rolki" }))).toBeNull();
    expect(toStub(item({ sport: "Triathlon" }))).toBeNull();
  });

  it("maps the Polish discipline label", () => {
    expect(toStub(item({ name: "Rower · SZOSA" }))?.discipline).toEqual(["road"]);
    expect(toStub(item({ name: "Rower · MTB" }))?.discipline).toEqual(["mtb"]);
    expect(toStub(item({ name: "Rower · BMX" }))?.discipline).toEqual(["bmx"]);
    expect(toStub(item({ name: "Rower · TOR" }))?.discipline).toEqual(["track"]);
  });

  it("keeps a multi-day range", () => {
    expect(toStub(item({ endDate: "2026-09-13" }))?.endDate).toBe("2026-09-13");
  });

  it("treats the unknown-venue placeholder as no place", () => {
    expect(toStub(item({ location: { name: "[?]", address: { addressCountry: "PL" } } }))?.placeText).toBe("");
  });

  it("rejects an entry with no id or no date", () => {
    expect(toStub(item({ url: "https://odjazd.pl/" }))).toBeNull();
    expect(toStub(item({ startDate: "" }))).toBeNull();
  });
});

describe("eventName", () => {
  it("takes the race's own name off its page", () => {
    expect(eventName(ld({ "@type": "SportsEvent", name: "Wtorkowe Czasówki — #15" }))).toBe(
      "Wtorkowe Czasówki — #15",
    );
  });

  it("refuses the listing's discipline label", () => {
    expect(eventName(ld({ "@type": "SportsEvent", name: "Rower · SZOSA" }))).toBeNull();
  });

  it("returns nothing when the page carries no event", () => {
    expect(eventName(ld({ "@type": "WebSite", name: "odjazd.pl" }))).toBeNull();
  });
});

describe("upcomingWeeks", () => {
  it("numbers ISO weeks from the given day", () => {
    expect(upcomingWeeks(3, new Date("2026-08-31T00:00:00Z"))).toEqual([
      "2026-W36",
      "2026-W37",
      "2026-W38",
    ]);
  });

  it("rolls into the next year", () => {
    expect(upcomingWeeks(2, new Date("2026-12-28T00:00:00Z"))).toEqual(["2026-W53", "2027-W01"]);
  });
});
