import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completionOrder, daysBeforeNextLook, documentIsAboutRace, ownSourcePages, regulationsQuery, statesRaceDay, takeSearch, usableHits, websiteMayBeReplaced } from "@/lib/catalog/race-completeness";

const require = createRequire(import.meta.url);
const { betterWebsite } = require("../../../scripts/local-fills.cjs");
const now = Date.parse("2026-11-06T12:00:00Z");
const race = (over: object) => ({ name: "Závod", start_date: "2026-11-20", practical_details: {}, country: "CZ", ...over });

describe("which known race is worked on next", () => {
  it("nearest Czech and Slovak races first, then near ones elsewhere, then later ones", () => {
    const list = [race({ name: "far cz", start_date: "2027-05-01" }), race({ name: "near it", country: "IT", start_date: "2026-11-08" }), race({ name: "near sk", country: "SK" }), race({ name: "far it", country: "IT", start_date: "2027-05-01" })];
    expect(list.sort((a, b) => completionOrder(a, b, now)).map(r => r.name)).toEqual(["near sk", "near it", "far cz", "far it"]);
  });
  it("comes back sooner the nearer the race, and rarely once it has everything", () => {
    expect(daysBeforeNextLook(race({ start_date: "2026-11-30" }), false, now)).toBe(3);
    expect(daysBeforeNextLook(race({ start_date: "2027-01-15" }), false, now)).toBe(7);
    expect(daysBeforeNextLook(race({ start_date: "2027-06-01" }), false, now)).toBe(21);
    expect(daysBeforeNextLook(race({ start_date: "2027-06-01" }), true, now)).toBe(3);
    expect(daysBeforeNextLook(race({ start_date: "2027-06-01", practical_details: { organizer: {}, schedule: {}, fees: {}, categories: {} } }), false, now)).toBe(30);
  });
});

describe("searching for a race's documents", () => {
  it("asks in the country's own word", () => {
    expect(regulationsQuery({ name: "Hůrecký krpál", start_date: "2026-11-07", municipality: "Hůrka", country: "CZ" })).toBe("Hůrecký krpál Hůrka 2026 propozice");
    expect(regulationsQuery({ name: "Cross Köln", start_date: "2027-01-10", municipality: "Köln", country: "DE" })).toBe("Cross Köln 2027 Ausschreibung");
  });
  it("opens neither calendars nor entry listings", () => {
    const urls = ["https://spsvd.cz/hurecky-krpal-2026/", "https://kalendar.winspace.cz/kalendar/x", "https://www.facebook.com/events/1", "https://odjazd.pl/wydarzenie/x"];
    expect(usableHits(urls, { name: "Hůrecký krpál", start_date: "2026-11-07" }, new Set())).toEqual(["https://spsvd.cz/hurecky-krpal-2026/"]);
  });
  it("asks by place and day when the catalogue's name may not be the race's own", async () => {
    const { placeAndDayQuery } = await import("@/lib/catalog/race-completeness");
    expect(placeAndDayQuery({ start_date: "2026-11-07", municipality: "Hůrka", discipline: "cx", country: "CZ" })).toBe("Hůrka cyklokros 7.11.2026");
    expect(placeAndDayQuery({ start_date: "2026-11-07", municipality: null })).toBeNull();
  });
  it("opens neither a calendar's listing nor a site's front page unless the site is the race's", () => {
    expect(usableHits(["https://www.cyklokros.cz/kalendar", "https://tbcserie.cz/", "https://hurka.cz/"], { name: "TBC — Hůrka", start_date: "2026-11-07" }, new Set())).toEqual(["https://hurka.cz/"]);
  });
  it("skips what was already read", () => {
    expect(usableHits(["https://a.cz/x"], { name: "A", start_date: "2026-11-07" }, new Set(["https://a.cz/x"]))).toEqual([]);
  });
});

describe("what may speak for a race", () => {
  const hurka = { name: "Hůrecký krpál", start_date: "2026-11-07", municipality: "Hůrka u Jistebnice" };
  const regulations = "HŮRECKÝ KRPÁL cyklokrosový závod TBC série. Datum Sobota 7.11.2026 Místo Hůrka u Jistebnice. Startovné, kategorie, kolo.";
  it("accepts a page with the race's own name for a round the catalogue labels by series and place", () => {
    expect(documentIsAboutRace(regulations, { name: "TBC — HŮRKA", start_date: "2026-11-07", municipality: "Hůrka u Jistebnice" })).toBe(true);
  });
  it("refuses a page of another race in that town", () => {
    expect(documentIsAboutRace("Cyklokros Tábor TBC série 7.11.2026, Tábor", { name: "TBC — HŮRKA", start_date: "2026-11-07", municipality: "Hůrka u Jistebnice" })).toBe(false);
  });
  it("refuses another year's event whose sidebar lists this race", () => {
    expect(documentIsAboutRace("Soběšická Mulda 12. 10. 2025 MTB závod Brno. Další nejbližší akce: 7. 11. 2026 Brněnský cyklokrosový pohár", { name: "Brněnský cyklokrosový pohár", start_date: "2026-11-07", municipality: "Pisárky" })).toBe(false);
  });
  it("refuses a casino in the same town on the same day", () => {
    expect(documentIsAboutRace("Grand Prix Šamorín v pokeru, Card Casino Šamorín, 22.11.2026, 8. kolo turnaje", { name: "8. kolo: Grand Prix Šamorín (UCI C2)", start_date: "2026-11-22", municipality: "Šamorín" })).toBe(false);
  });
  it("refuses a page listing the race's day and name far apart", () => {
    const far = `Vimperk cyklokros TBC ${"x ".repeat(800)} 14.11.2026 MTB závod Šumava`;
    expect(documentIsAboutRace(far, { name: "TBC — VIMPERK", start_date: "2026-11-14", municipality: "Vimperk" })).toBe(false);
  });
  it("recognises the day however it is written", () => {
    expect(statesRaceDay("Sobota 7.11.2026", "2026-11-07")).toBe(true);
    expect(statesRaceDay("07. 11. 2026", "2026-11-07")).toBe(true);
    expect(statesRaceDay("17.11.2026", "2026-11-07")).toBe(false);
    expect(statesRaceDay("7.12.2026", "2026-11-07")).toBe(false);
  });
  it("accepts the race's own regulations", () => {
    expect(documentIsAboutRace(regulations, hurka)).toBe(true);
  });
  it("refuses last year's edition and another race of the series", () => {
    expect(documentIsAboutRace(regulations.replace("7.11.2026", "2.11.2025"), hurka)).toBe(false);
    expect(documentIsAboutRace("Cyklokros Tábor TBC série, kolo, 1.11.2026 Tábor", hurka)).toBe(false);
  });
  it("takes only a race's own pages from its sources", () => {
    expect(ownSourcePages(["https://tbcserie.cz/kalendar-2026/zavod-203/", "https://kalendar.winspace.cz/kalendar/x", "https://maraton.cz/terminovka", "https://tbcserie.cz/", null])).toEqual(["https://tbcserie.cz/kalendar-2026/zavod-203/"]);
  });
});

describe("the link a found page may replace", () => {
  it("nothing, a homepage or a calendar, never a race's own page", () => {
    expect(websiteMayBeReplaced(null)).toBe(true);
    expect(websiteMayBeReplaced("http://www.tbcserie.cz/")).toBe(true);
    expect(websiteMayBeReplaced("https://kalendar.winspace.cz/kalendar/x")).toBe(true);
    expect(websiteMayBeReplaced("https://spsvd.cz/hurecky-krpal/")).toBe(false);
  });
  it("on the server likewise, unless someone changed it since the copy", () => {
    expect(betterWebsite("https://a.cz/zavod", "https://a.cz/", "https://a.cz/")).toBe(true);
    expect(betterWebsite("https://a.cz/zavod", "https://odjazd.pl/x", "https://odjazd.pl/x")).toBe(true);
    expect(betterWebsite("https://a.cz/zavod", "https://a.cz/", "https://b.cz/")).toBe(false);
    expect(betterWebsite("https://a.cz/zavod", "https://b.cz/page", "https://b.cz/page")).toBe(false);
    expect(betterWebsite("https://odjazd.pl/x", "https://a.cz/", "https://a.cz/")).toBe(false);
  });
});

describe("the count of paid searches", () => {
  it("stops at the daily limit and starts again the next day", () => {
    const path = join(mkdtempSync(join(tmpdir(), "search-")), "budget.json");
    const today = new Date("2026-11-06T10:00:00Z"), tomorrow = new Date("2026-11-07T10:00:00Z");
    expect(takeSearch(path, { day: 2, month: 3 }, today)).toBe(true);
    expect(takeSearch(path, { day: 2, month: 3 }, today)).toBe(true);
    expect(takeSearch(path, { day: 2, month: 3 }, today)).toBe(false);
    expect(takeSearch(path, { day: 2, month: 3 }, tomorrow)).toBe(true);
    expect(takeSearch(path, { day: 2, month: 3 }, tomorrow)).toBe(false);
  });
});

describe("results of a race", () => {
  it("takes the server the regulations name", async () => {
    const { resultsLinkIn } = await import("@/lib/catalog/race-completeness");
    expect(resultsLinkIn("Ceny: Medaile pro první tři. Výsledky: www.maraton.cz\nParkování")).toBe("https://www.maraton.cz");
    expect(resultsLinkIn("Ergebnisse: https://my.raceresult.com/123/results.")).toBe("https://my.raceresult.com/123/results");
    expect(resultsLinkIn("Výsledky budou vyhlášeny v 15:30")).toBeNull();
  });
});

describe("the link to a race's regulations", () => {
  const race = { name: "Hůrecký krpál", start_date: "2026-11-07", municipality: "Hůrka u Jistebnice" };
  const text = "HŮRECKÝ KRPÁL cyklokrosový závod. Datum Sobota 7.11.2026 Místo Hůrka u Jistebnice, kolo.";
  it("is saved when a PDF was reached through the organiser's page", async () => {
    const { regulationsAmong } = await import("@/lib/catalog/race-completeness");
    expect(regulationsAmong([{ url: "https://spsvd.cz/hurecky-krpal/", text }, { url: "https://spsvd.cz/2026_Hurecky_krpal_propozice.pdf", text }], race)).toBe("https://spsvd.cz/2026_Hurecky_krpal_propozice.pdf");
  });
  it("is not taken from an ordinary page or another race's file", async () => {
    const { regulationsAmong } = await import("@/lib/catalog/race-completeness");
    expect(regulationsAmong([{ url: "https://spsvd.cz/hurecky-krpal/", text }], race)).toBeNull();
    expect(regulationsAmong([{ url: "https://a.cz/cunkovak-propozice.pdf", text: "Čuňkovák cyklokros 12.10.2026" }], race)).toBeNull();
  });
});

describe("documents worth a link of their own", () => {
  const race = { name: "Hůrecký krpál", start_date: "2026-11-07", municipality: "Hůrka u Jistebnice", website_url: "https://tbcserie.cz/kalendar-2026/zavod-203/" };
  const text = "HŮRECKÝ KRPÁL cyklokrosový závod. Datum Sobota 7.11.2026 Místo Hůrka u Jistebnice, kolo.";
  it("tells instructions, regulations and series rules apart", async () => {
    const { documentLinks } = await import("@/lib/catalog/race-completeness");
    expect(documentLinks([
      { url: "https://spsvd.cz/2026_krpal_propozice.pdf", text },
      { url: "https://spsvd.cz/organizacni-pokyny-krpal.pdf", text: `Organizační pokyny. ${text}` },
      { url: "https://tbcserie.cz/pravidla", text: "Pravidla TBC série" },
    ], race)).toEqual([
      { kind: "regulations", url: "https://spsvd.cz/2026_krpal_propozice.pdf" },
      { kind: "instructions", url: "https://spsvd.cz/organizacni-pokyny-krpal.pdf" },
      { kind: "series_rules", url: "https://tbcserie.cz/pravidla" },
    ]);
  });
  it("takes no instructions of another race, nor rules of a foreign site", async () => {
    const { documentLinks } = await import("@/lib/catalog/race-completeness");
    expect(documentLinks([{ url: "https://a.cz/organizacni-pokyny.pdf", text: "Organizační pokyny Čuňkovák cyklokros 12.10.2026" }, { url: "https://jiny.cz/pravidla", text: "Pravidla" }], race)).toEqual([]);
  });
  it("looks every other day in a race's last two weeks until instructions are out", async () => {
    const { daysBeforeNextLook } = await import("@/lib/catalog/race-completeness");
    const soon = "2026-11-12";
    expect(daysBeforeNextLook({ name: "A", start_date: soon, practical_details: {} }, false, now)).toBe(2);
    expect(daysBeforeNextLook({ name: "A", start_date: soon, practical_details: { organizer: {}, schedule: {}, fees: {}, categories: {}, documents: { value: [{ kind: "instructions" }] } } }, false, now)).toBe(30);
  });
});
