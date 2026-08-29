import { describe, expect, it } from "vitest";
import { inferClassification } from "@/lib/taxonomy";
import { resolveLevel } from "@/lib/classify-level";
import { fold, hasToken, hasTokenFollowedBy } from "@/lib/text-match";
import { isNonCyclingEventName, hasCyclingSignal, looksLikeRunningEvent } from "@/lib/sport-gate";
import { isSiteIdentityName } from "@/lib/watcher/extractors/generic";
import { isAccountOrNewsletterUrl } from "@/lib/watcher/registration-url";
import { publicRaceUrl, resolveEventOutboundUrls } from "@/lib/watcher/public-url";
import { isSeparateRace } from "@/lib/catalog/merge-duplicates";

/**
 * Every case below is a row that was actually wrong in the live catalog.
 * Keep them: they are the regression surface for the classifier, and each one
 * cost a manual audit to find.
 */

describe("unicode-safe token matching", () => {
  it("folds diacritics before applying word boundaries", () => {
    expect(fold("Spätsommercross")).toBe("spatsommercross");
    expect(fold("späť")).toBe("spat");
    expect(fold("Špičák")).toBe("spicak");
    expect(fold("Łódź")).toBe("lodz");
  });

  it("does not find SP inside an accented word", () => {
    // JS \b is ASCII-only, so /\bsp\b/ used to match both of these.
    expect(hasToken("CTF Spätsommercross", "sp")).toBe(false);
    expect(hasToken("Rodinná Cyklostopa … a späť 2026", "sp")).toBe(false);
    expect(hasToken("SP NMNM", "sp")).toBe(true);
  });

  it("matches an abbreviation only when the next word qualifies it", () => {
    expect(hasTokenFollowedBy("MS MTB XCO 2026", "ms", ["mtb"])).toBe(true);
    expect(hasTokenFollowedBy("Köglalm Bergrennen mit Tiroler MS", "ms", ["mtb"])).toBe(false);
  });
});

describe("sport gate", () => {
  const notBikeRaces = [
    "Hannover-Lahe Triathlon",
    "Brettmühlenteich-Duathlon",
    "23. Hospiz-Spendenlauf des Hospiz- und Palliativdienst Chemnitz e.V.",
    "XLV. Internationaler 100km-Lauf bzw. 11. Störitzsee-Lauf 2026",
    "1. Crosslauf Flachslanden",
    "Sudety Ultra Trail",
    "Triatlon Decimuž",
  ];
  for (const name of notBikeRaces) {
    it(`rejects "${name.slice(0, 40)}"`, () => {
      expect(isNonCyclingEventName(name)).toBe(true);
    });
  }

  const bikeRaces = [
    // German "Lauf" is a series round far more often than it is a run.
    "2. Lauf Isarcup MTB",
    "4. Lauf MTB Hessencup in Wiesbaden 2025",
    "LVM MTB Saarlandliga Lauf 3 - Auto Frank&Tan Kirmesrennen",
    "Schwaben Gravel Trophy 2026, Lauf #3 in 87719 Mindelheim",
    "Bergzeitfahren Schmelz Lauf zum Hessen Berg Cup",
    // Multisport with a real bike leg belongs in the catalog.
    "MTB Biatlon - PRIOR u Přeštic - IZ (Časovka)",
    "Swim & Bike - Cross",
    // Ordinary races that happen to carry a trail/marathon word.
    "Trailpark Klínovec Enduro",
    "Nationalpark Bike-Marathon",
  ];
  for (const name of bikeRaces) {
    it(`keeps "${name.slice(0, 40)}"`, () => {
      expect(isNonCyclingEventName(name)).toBe(false);
    });
  }

  it("treats an ordinal Lauf as a round, a compound Lauf as a run", () => {
    expect(looksLikeRunningEvent("2. Lauf Isarcup MTB")).toBe(false);
    expect(looksLikeRunningEvent("Volkslauf Musterstadt")).toBe(true);
  });

  it("recognises cycling signals across languages", () => {
    for (const n of ["Cyklomaraton", "Radmarathon", "VTT Cergy", "Rower MTB", "Giro delle Bici"]) {
      expect(hasCyclingSignal(n)).toBe(true);
    }
  });
});

describe("race level", () => {
  it("keeps the UCI Gran Fondo ladder out of the World Cup tier", () => {
    // Amateur qualifier series — it carries "UCI" and "World", but it is not
    // elite racing and must not outrank a national championship.
    for (const name of [
      "UCI Gran Fondo Jordan Dead Sea",
      "Granfondo Antalya",
      "13. ročník DEKOM SYSTEM SUDETY TOUR součást UCI GRAN FONDO WORLD SERIES",
    ]) {
      const r = resolveLevel({ name, seriesName: "UCI Gran Fondo World Series" });
      expect(r.level).toBe("international");
    }
  });

  it("reads SP as the national cup unless a world marker is present", () => {
    expect(resolveLevel({ name: "SP CC 2026 kritérium", countryHint: "SK" }).level).toBe("national");
    expect(resolveLevel({ name: "Slovenský pohár Gravel - NyNa Cup 2.kolo" }).level).toBe("national");
    expect(resolveLevel({ name: "SP NMNM", countryHint: "CZ" }).level).toBe("world_cup");
    expect(resolveLevel({ name: "SVĚTOVÝ POHÁR XCO 2026" }).level).toBe("world_cup");
  });

  it("does not promote accented words into World Cups", () => {
    expect(resolveLevel({ name: "CTF Spätsommercross" }).level).toBe("local");
    expect(
      resolveLevel({ name: "Rodinná Cyklostopa z Ponickej Huty na Povrazník a späť 2026" }).level,
    ).toBe("local");
  });

  it("separates a European Cup from a European Championship", () => {
    expect(resolveLevel({ name: "2026 UEC BMX EUROPEAN CUP - ROUNDS 5 & 6" }).level).toBe("continental");
    expect(
      resolveLevel({ name: "2026 UEC TRACK JUNIORS & UNDER 23 EUROPEAN CHAMPIONSHIPS" }).level,
    ).toBe("european_championship");
  });

  it("still recognises the real top tier", () => {
    expect(resolveLevel({ name: "2026 UCI Mountain Bike World Championships - Val di Sole" }).level).toBe(
      "world_championship",
    );
    expect(resolveLevel({ name: "UCI MTB World Series — Lenzerheide" }).level).toBe("world_cup");
    expect(resolveLevel({ name: "Mistrovství České republiky XCO" }).level).toBe("national");
  });
});

describe("age categories", () => {
  it("marks defaulted ages as such so a merge cannot treat them as evidence", () => {
    const guessed = inferClassification({ name: "Nationalpark Bike-Marathon", startDate: "2026-08-28" });
    expect(guessed.ageConfidence).toBe("default");

    const stated = inferClassification({ name: "Talent Cup U13 Nové Město", startDate: "2026-05-01" });
    expect(stated.ageConfidence).toBe("explicit");
    expect(stated.ageCategories).toContain("u13");
  });

  it("gives the Gran Fondo ladder amateur ages, not junior-to-elite", () => {
    const c = inferClassification({
      name: "Granfondo Antalya",
      seriesName: "UCI Gran Fondo World Series",
      startDate: "2026-04-12",
    });
    expect(c.ageCategories).toEqual(expect.arrayContaining(["amateur", "masters"]));
    expect(c.ageCategories).not.toContain("elite");
  });

  it("leaves ages empty rather than guessing on an unmarked local race", () => {
    const c = inferClassification({ name: "AMATÉŘI Nížina cup 2.etapa", startDate: "2026-08-28" });
    expect(c.ageConfidence).not.toBe("default");
  });
});

describe("generic extractor guard", () => {
  it("drops titles that name the site rather than a race", () => {
    const junk: [string, string][] = [
      ["Domů", "https://pohardrahanskevrchoviny.cz"],
      ["Novinky", "https://pohardrahanskevrchoviny.cz"],
      ["nizinacup", "https://nizinacup.webnode.cz"],
      ["TJ FAVORIT BRNO", "http://favoritbrno.cz"],
      ["CYKLOŠVEC s.r.o.", "https://cyklosvec.cz"],
      ["MTBPODRALSKO", "https://mtbpodralsko.cz"],
      ["Radmarathon", "https://neusiedlersee-radmarathon.com"],
    ];
    for (const [name, url] of junk) {
      expect(isSiteIdentityName(name, url), name).toBe(true);
    }
  });

  it("keeps real race names, including one-word and club-run ones", () => {
    const races: [string, string][] = [
      ["Glocknerkönig", "https://glocknerkoenig.at/info"],
      ["Quebrantahuesos", "https://sportmaniacs.com/es/x"],
      ["Nieuwjaarscross", "https://uci.org/calendar"],
      ["Kriterium des RSV Speiche e.V. Leipzig", "https://radsport-sachsen.de/t"],
      ["Wembloudovy Hrby", "https://mtbcup.cz/zavody"],
    ];
    for (const [name, url] of races) {
      expect(isSiteIdentityName(name, url), name).toBe(false);
    }
  });
});

describe("link quality", () => {
  it("rejects sign-in pages and newsletter anchors as race links", () => {
    for (const url of [
      "https://www.ixsdownhillcup.com/en/login",
      "https://www.rookiescup.bike/en/login",
      "https://www.cyclingaustria.at/#newsletter-anmeldung",
      "https://example.cz/prihlaseni",
      "https://example.de/anmelden/",
    ]) {
      expect(isAccountOrNewsletterUrl(url), url).toBe(true);
      expect(publicRaceUrl(url), url).toBeNull();
    }
  });

  it("keeps real entry and race pages", () => {
    for (const url of [
      "https://www.enduroserie.cz/zavody/",
      "https://sudetytour.cz",
      "https://www.detskymtbcup.cz/prihlaska-na-zavod",
    ]) {
      expect(isAccountOrNewsletterUrl(url), url).toBe(false);
    }
  });
});

describe("federation listing links", () => {
  it("uses an FCI race page as the listing when there is no organiser link", () => {
    const out = resolveEventOutboundUrls({
      sourceUrls: ["https://members.federciclismo.it/race/detail/178877"],
    });
    expect(out.websiteUrl).toBeNull();
    expect(out.listingUrl).toBe("https://members.federciclismo.it/race/detail/178877");
  });

  it("never promotes a federation page to the race's own website", () => {
    expect(publicRaceUrl("https://members.federciclismo.it/race/detail/178877")).toBeNull();
  });

  it("prefers the organiser's own site over the federation page", () => {
    const out = resolveEventOutboundUrls({
      websiteUrl: "https://granfondogimondi.it",
      sourceUrls: ["https://members.federciclismo.it/race/detail/178877"],
    });
    expect(out.websiteUrl).toBe("https://granfondogimondi.it");
    expect(out.listingUrl).toBeNull();
  });
})

describe("event type", () => {
  it("files non-competitive rides as rides, not races", () => {
    for (const name of [
      "LA PREVOSTURA PEDALATA ECOLOGICA",
      "RANDONNEE' DEI LEONI - TREESPORT",
      "2^ Ciclopedalata del Folliage",
      "LA LIBERTY GRANFONDO ESCURSIONISTICA",
      "GIOCO CICLISMO BRUSSON",
      "2° GINKANA COMUNE DI LOCATE VARESINO - GIOCO CICLISMO",
    ]) {
      expect(inferClassification({ name, startDate: "2026-09-01" }).eventType, name).toBe("ride");
    }
  });

  it("still files real races as races", () => {
    for (const name of [
      "54° GRAN PREMIO INDUSTRIA COMMERCIO ARTIGIANATO CARNAGHESE",
      "TROFEO CITTA' DI FONZASO",
      "3A OLTREPO' GRAVEL",
    ]) {
      expect(inferClassification({ name, startDate: "2026-09-01" }).eventType, name).not.toBe("ride");
    }
  });
});

describe("duplicate guards", () => {
  const pair = (a: string, b: string) => ({
    a: { name: a, start_date: "2026-09-13", end_date: null, id: "a" },
    b: { name: b, start_date: "2026-09-13", end_date: null, id: "b" },
  });

  it("keeps an e-bike heat separate from the analogue race", () => {
    // Same course, same day, its own race — one extra word in the title.
    const { a, b } = pair("ENDURO MARCHE SERIES E-BIKE CINGOLI", "ENDURO MARCHE SERIES CINGOLI");
    expect(isSeparateRace(a.name, b.name)).toBe(true);
  });

  it("keeps a recreational ride separate from the race it accompanies", () => {
    // FCI listed both at Primiero on one day; merging lost the World Championship.
    const { a, b } = pair(
      "MYTHOS PRIMIERO PEDALATA ECOLOGICA",
      "ABBINATA NAZ. XCM - CAMPIONATO MONDIALE MASTER UCI XCM - PRIMIERO",
    );
    expect(isSeparateRace(a.name, b.name)).toBe(true);
  });

  it("keeps an Italian category race separate from the open one", () => {
    const { a, b } = pair("18° MEMORIAL ADOLFO PARMALIANA-ALLIEVI", "18° MEMORIAL ADOLFO PARMALIANA");
    expect(isSeparateRace(a.name, b.name)).toBe(true);
  });

  it("still treats a reworded title as the same race", () => {
    const { a, b } = pair(
      "Třetí letní kritérium horských kol - Povltavský letní bikerský pohár",
      "Povltavský bikerský pohár - Třetí letní kritérium horských kol",
    );
    expect(isSeparateRace(a.name, b.name)).toBe(false);
  });
});
