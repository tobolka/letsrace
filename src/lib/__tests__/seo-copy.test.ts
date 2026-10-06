import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventListItem } from "@/lib/events";
import { counted, inCountry } from "@/lib/seo";
import { DESCRIPTION_MAX, raceDescription, raceTitle, TITLE_MAX, unshout } from "@/lib/seo-race-copy";

function race(over: Partial<EventListItem>): EventListItem {
  return {
    id: "1",
    slug: "x",
    name: "Jihlavský HROT",
    startDate: "2026-09-26",
    endDate: null,
    disciplines: ["xco"],
    formats: [],
    audience: "all",
    ageCategories: [],
    ageConfidence: null,
    status: "scheduled",
    visibility: "public",
    eventType: "race",
    competitionType: "race",
    season: null,
    websiteUrl: null,
    registrationUrl: null,
    regulationsUrl: null,
    resultsUrl: null,
    listingUrl: null,
    sourceKind: "manual",
    level: "regional",
    classLabel: null,
    uciClass: null,
    lastSeenAt: null,
    location: { id: "l", name: "Jihlava", municipality: "Jihlava", countryCode: "CZ", lat: null, lng: null },
    series: null,
    ...over,
  } as EventListItem;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("race title", () => {
  it("names the race, its year, the kind of race and the town", () => {
    expect(raceTitle(race({}), "cs")).toBe("Jihlavský HROT 2026 – MTB závod, Jihlava");
    expect(raceTitle(race({ disciplines: ["road"] }), "en")).toBe("Jihlavský HROT 2026 – road race in Jihlava");
  });

  it("does not repeat a town or a kind the name already says", () => {
    const thale = race({ name: "Gravity-Cup Thale 2026", disciplines: ["mtb"], location: { id: "l", name: "Thale", municipality: "Thale", countryCode: "DE", lat: null, lng: null } });
    expect(raceTitle(thale, "de")).toBe("Gravity-Cup Thale 2026 – MTB-Rennen");
    const chynov = race({ name: "Cyklokros Chýnov", disciplines: ["cx"], location: { id: "l", name: "Chýnov", municipality: "Chýnov", countryCode: "CZ", lat: null, lng: null } });
    expect(raceTitle(chynov, "cs")).toBe("Cyklokros Chýnov 2026");
  });

  it("takes the town, not the venue, from a combined place", () => {
    const haid = race({ name: "Jura-Radmarathon", disciplines: ["road"], location: { id: "l", name: "x", municipality: "Sportheim, Lupburg", countryCode: "DE", lat: null, lng: null } });
    expect(raceTitle(haid, "cs")).toBe("Jura-Radmarathon 2026 – silniční závod, Lupburg");
  });

  it("stays short enough to be shown whole", () => {
    const long = race({ name: "15. PIKO-BIKE MARATON 2026 a 5. kolo SLOVENSKÉHO POHÁRA GRAVEL – NyNa CUP 2026", disciplines: ["gravel"] });
    const title = raceTitle(long, "cs");
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title.startsWith("15. Piko-Bike Maraton 2026")).toBe(true);
  });
});

describe("unshout", () => {
  it("writes a name typed in capitals as a title", () => {
    expect(unshout("CICLOCROSS DEL LAGO - MEMORIAL GIGI")).toBe("Ciclocross del Lago - Memorial Gigi");
    expect(unshout("LA SPOLETONORCIA GRAVEL")).toBe("La Spoletonorcia Gravel");
    expect(unshout("UCI CX GRAN PREMIO")).toBe("UCI CX Gran Premio");
  });

  it("leaves a name in mixed case as written", () => {
    expect(unshout("Jihlavský HROT")).toBe("Jihlavský HROT");
    expect(unshout("MTB Pomerania — BARŁOMINO")).toBe("MTB Pomerania — BARŁOMINO");
  });
});

describe("race description", () => {
  it("is sentences, not labels, and fits the snippet", () => {
    const d = raceDescription(
      race({ registrationUrl: "https://e", regulationsUrl: "https://r", ageConfidence: "explicit", ageCategories: ["u11", "u13"] }),
      "cs",
    );
    expect(d.startsWith("MTB závod – sobota 26. září 2026, Jihlava (Česko).")).toBe(true);
    expect(d).toContain("Přihlásit se dá online.");
    expect(d).not.toContain("Přihlášky, Propozice");
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("says a two-day race once", () => {
    expect(raceDescription(race({ endDate: "2026-09-27" }), "cs")).toContain("26.–27. září 2026");
    expect(raceDescription(race({ endDate: "2026-09-27" }), "en")).toContain("from 26 to 27 September 2026");
    expect(raceDescription(race({ startDate: "2026-10-31", endDate: "2026-11-01" }), "de")).toContain("vom 31. Oktober bis 1. November 2026");
  });
});

describe("hub words", () => {
  it("puts the country in the case the language wants", () => {
    expect(inCountry("CZ", "Česko", "cs")).toBe("v Česku");
    expect(inCountry("CH", "Švýcarsko", "cs")).toBe("ve Švýcarsku");
    expect(inCountry("CH", "Schweiz", "de")).toBe("in der Schweiz");
    expect(inCountry("FR", "Francie", "cs")).toBe("v zemi Francie");
  });

  it("counts in each language's plural forms", () => {
    expect(counted(1, "round", "cs")).toBe("1 kolo");
    expect(counted(3, "round", "cs")).toBe("3 kola");
    expect(counted(10, "round", "cs")).toBe("10 kol");
    expect(counted(22, "race", "pl")).toBe("22 wyścigi");
    expect(counted(25, "race", "pl")).toBe("25 wyścigów");
  });
});
