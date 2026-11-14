import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ppkEvents, readGps, readPpkCard, readPpkRules, weekdayMismatch } from "@/lib/watcher/extractors/ppkbike";
import { isSamePlace, placeCorrectedByHand } from "@/lib/watcher/update-policy";
import { preferEventName } from "@/lib/dedup";

// ppkbike.cz as it stood on 2026-11-14: the rules page and the nine race cards.
const dir = join(__dirname, "fixtures/ppkbike");
const rules = readFileSync(join(dir, "pravidla-2026-11-14.html"), "utf8");
const cards = new Map([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, readFileSync(join(dir, `card-${n}-2026-11-14.html`), "utf8")]));
const events = ppkEvents(rules, cards);

// The nine 2027 races already in the catalogue on 2026-11-14 (source external id, date, name, in the series or not, place).
const CATALOGUE = [
  ["ppkbike-2027-round-1", "2027-03-20", "Golf Open Bike Race – časovka", true, "Autokemp Diana - Ejpovice"],
  ["ppkbike-2027-round-2", "2027-04-18", "Velká cena města Touškova", true, "Touškovská rokle"],
  ["ppkbike-2027-round-3", "2027-05-16", "Velká cena Domažlic MTB", true, "Domažlice, lesopark Škarman, parkoviště pod Škarmanem"],
  ["ppkbike-2027-round-4", "2027-05-30", "MTB Litohlavy – Na Vršíčku", true, "Litohlavy, pod Vršíčkem"],
  ["ppkbike-2027-round-5", "2027-06-12", "Mistrovství Plzeňského kraje tříčlenných družstev", false, "Přeštice, areál VČAS PRIOR"],
  ["ppkbike-2027-round-6", "2027-06-13", "Memoriál Vítka Přerosta", true, "Přeštice, areál VČAS PRIOR"],
  ["ppkbike-2027-round-7", "2027-09-04", "Velká cena Klatov", true, "Klatovy, Klatovský bor, Podborská ulice"],
  ["ppkbike-2027-round-8", "2027-09-11", "Velká cena MSBA", true, "Plzeň-Božkov, údolí Božkovského potoka"],
  ["ppkbike-2027-round-9", "2027-09-20", "MTB Čerchov", false, "Pec pod Čerchovem, louka za hřištěm"],
] as const;

describe("PPKBIKE from the rules page and the race cards", () => {
  it("reads the nine 2027 races: seven scored rounds and two partner races", () => {
    const races = readPpkRules(rules);
    expect(races.map(race => race.date)).toEqual(CATALOGUE.map(row => row[1]));
    expect(races.filter(race => !race.partner)).toHaveLength(7);
    expect(races.filter(race => race.partner).map(race => race.round)).toEqual([5, 9]);
  });

  it("matches the races already in the catalogue on a repeated import, keeping their names", () => {
    expect(events.map(event => [event.externalId, event.startDate])).toEqual(CATALOGUE.map(row => [row[0], row[1]]));
    for (const [index, row] of CATALOGUE.entries()) {
      const event = events[index]!;
      expect(Boolean(event.seriesSlug), row[0]).toBe(row[3]);
      // The importer keeps the stored name unless the source's is better; these are the same names.
      expect(preferEventName(row[2], event.name, event.placeText), row[0]).toBe(row[2]);
    }
    expect(events.filter(event => event.seriesSlug === "ppkbike")).toHaveLength(7);
  });

  it("reads each card's venue, position, organiser, contact and fees", () => {
    expect(readPpkCard(cards.get(2)!)).toEqual({
      venue: "Město Touškov, les za rybníkem", organizer: "TJ Sokol Město Touškov", director: "Pavel FOLTÝN",
      contact: "602 406 602 - foltynpavel45@gmail.com", website: "https://www.sokoltouskov.cz",
      fees: [
        { label: "kluci 5-6 holky 5-6 kluci 7-8 holky 7-8 kluci 9-10 holky 9-10", amount: 200, currency: "CZK" },
        { label: "žáci I žákyně I žáci II žákyně II", amount: 300, currency: "CZK" },
        { label: "kadeti kadetky junioři juniorky ženy muži muži 40 muži 50", amount: 350, currency: "CZK" },
      ],
    });
    expect(events.map(event => event.placeText)).toEqual(CATALOGUE.map(row => row[0] === "ppkbike-2027-round-2" ? "Město Touškov, les za rybníkem" : row[4]));
    expect(readGps("N 49°34.27400', E 13°21.50137'")).toEqual({ lat: 49.5712333, lng: 13.3583562 });
    // Touškov's card gives 93.57 seconds: no position at all rather than a wrong one.
    expect(readGps("49°46'93.57''N, 13°14'13.27''E")).toBeNull();
  });

  it("does not overwrite the corrected Touškovská rokle venue", () => {
    const touskov = events[1]!;
    const held = { name: "Touškovská rokle", municipality: "Město Touškov", geocode_query: "Touškovská rokle, Město Touškov, CZ", country_code: "CZ", lat: 49.7817181, lng: 13.2356414 };
    // The card names the place differently, so only the hand correction keeps it.
    expect(isSamePlace(held, { query: touskov.placeText, country: "CZ", lat: touskov.lat, lng: touskov.lng })).toBe(false);
    expect(placeCorrectedByHand([{ field: "practical.venue", method: "practical_details" }, { field: "practical.venue", method: "manual_venue_correction" }, { field: "venue_coordinates", method: "manual_venue_correction" }])).toBe(true);
    expect(placeCorrectedByHand([{ field: "location_id", method: "watcher" }])).toBe(false);
  });

  it("flags Čerchov, whose Sunday 20 September 2027 is a Monday, and keeps its date", () => {
    const cerchov = events[8]!;
    expect(cerchov.startDate).toBe("2027-09-20");
    expect(cerchov.sourceWarnings).toEqual(["weekday_mismatch: the page says neděle, 2027-09-20 is pondělí"]);
    expect(events.filter(event => event.sourceWarnings)).toHaveLength(1);
    expect(weekdayMismatch({ weekday: "neděle", date: "2027-04-18" })).toBeNull();
  });
});
