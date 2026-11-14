import { describe, expect, it } from "vitest";
import { datesInLine, literalEditionAnswer } from "@/lib/catalog/next-edition-literal";
import { decideEdition, type EditionRace } from "@/lib/catalog/next-edition";
import { placeRole, quoteIsNotTheStart, startPlace, withoutOtherPlaces } from "@/lib/catalog/place-roles";
import { practicalDetailsForEvent } from "@/lib/practical-details";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { fold } from "@/lib/text-match";

// Words as they stood on the organisers' pages on 2026-11-14.
const malevil: EditionRace = { id: "5d532221-f028-420c-829a-550178b88386", name: "ČP MTB XCM - Malevil cup", start_date: "2026-06-13", website_url: "https://www.malevilcup.cz/", disciplines: ["xcm"], municipality: "Jablonné v Podještědí", country: "CZ", event_type: "race" };
const MALEVIL_HOME = ["Registrace na Malevil Cup 2027 startuje 1. prosince! Registration for Malevil Cup 2027 opens on December 1!",
  "Prezence a výdej startovních čísel proběhne ve společenském centru Jablonné v Podještědí, v následujících termínech:", "Pátek 11. června 2027", "15:00 - 19:30 trasy A, B, C, D", "Sobota 12. června 2027", "6.30 - 7.30 trasa A"].join("\n");
const MALEVIL_REGULATIONS = ["28. INTERNATIONAL MTB MARATHON MALEVIL CUP 12. 6. 2027", "Jablonné v Podještědí / Lužické hory / Czech Republic",
  "Uzávěrka přihlášek: 6. 6. 2027 včetně.", "Pátek 11. 6. 2027 15.00 - 19.30 hod. trasy A, B, C, D", "Sobota 12. 6. 2027 6.30 - 7.30 hod. trasa A", "sobota 12. 6. 2027 - náměstí Jablonné v Podještědí"].join("\n");

const krizova: EditionRace = { id: "cba701b8-3568-4a82-9e0a-60ef36b2a938", name: "Křížová stezka 9. ročník", start_date: "2026-06-13", website_url: "https://biketeam.estranky.cz/clanky/zavod-krizova-stezka-2026/", disciplines: ["mtb"], municipality: "Zlaté Hory", country: "CZ", event_type: "race" };
const KRIZOVA = ["Závod Křížová stezka 2027", "Jubilejní 10.ročník (poslední) se plánuje na sobotu 12.června 2027", "Křížová stezka 2026 - 13.června", "Výsledky 2026:"].join("\n");

const MORAVA_REGULATIONS = ["V. MORAVA BIKE 2027", "Místo a termín závodu", "19 - 20.6.2027",
  "Prezence a Start - Sportovní areál a kemp Dolní Morava, Depo Olomouc, Depo Hodonín, Cíl - Riverpark Bratislava, Dvořákovo nábřeží 10",
  "Pořadatelem závodu je MORAVA FLOW z.s., se sídlem Babíčkova 1123/6, Olomouc, IČ 19424892",
  "Start Dolní Morava - Sportovní areál a kemp DM, Dolní Morava 7, Dolní Morava", "Depo Olomouc - ZŠ Svatoplukova, Svatoplukova 65/11, Olomouc - Řepčín",
  "Cíl Bratislava - River Park, Dvořákovo Nábrežie 7571/8A (u fontány), Bratislava"].join("\n");

describe("the next edition's date and its status", () => {
  it("takes Malevil's date from its regulations while the homepage leads with registration", () => {
    // The homepage's headline is the opening of registration, which is no race day.
    const home = literalEditionAnswer({ race: malevil, page: { url: "https://www.malevilcup.cz/", title: "Malevil Cup", text: MALEVIL_HOME.split("\n")[0]! }, year: 2027 });
    expect(home).toEqual({ state: "wait", reason: "literal_no_race_date_on_page" });
    const rules = literalEditionAnswer({ race: malevil, page: { url: "https://www.malevilcup.cz/index.php/propozice", title: "Propozice", text: MALEVIL_REGULATIONS }, year: 2027 });
    expect(rules).toMatchObject({ state: "answer", answer: { startDate: "2027-06-12", quote: "28. INTERNATIONAL MTB MARATHON MALEVIL CUP 12. 6. 2027" } });
  });

  it("reads a date written without a space after the day", () => {
    expect(datesInLine(fold("se plánuje na sobotu 12.června 2027"), 2027).map(found => found.start)).toEqual(["2027-06-12"]);
  });

  it("keeps Křížová stezka's planned date as provisional, with its page, and never publishes it", () => {
    const page = { url: "https://biketeam.estranky.cz/clanky/zavod-krizova-stezka-2027/", title: "Závod Křížová stezka 2027", text: KRIZOVA };
    const read = literalEditionAnswer({ race: krizova, page, year: 2027 });
    expect(read).toMatchObject({ state: "provisional", answer: { startDate: "2027-06-12", quote: "Jubilejní 10.ročník (poslední) se plánuje na sobotu 12.června 2027" } });
    if (read.state !== "provisional") throw Error("expected a provisional date");
    // Handed to the gate as if announced, it still waits: a planned date is not an announcement.
    expect(decideEdition({ race: { ...krizova, website_url: "https://biketeam.estranky.cz/" }, page, answer: { ...read.answer, announced: true }, year: 2027, today: "2026-11-14" })).toEqual({ state: "wait", reason: "tentative_date" });
  });

  it("confirms the date once the organiser drops the word planned", () => {
    const page = { url: "https://biketeam.estranky.cz/clanky/zavod-krizova-stezka-2027/", title: "Závod Křížová stezka 2027", text: KRIZOVA.replace("se plánuje na", "se koná v") };
    expect(literalEditionAnswer({ race: krizova, page, year: 2027 })).toMatchObject({ state: "answer", answer: { startDate: "2027-06-12" } });
  });
});

describe("start, depot and finish of a point-to-point race", () => {
  it("tells Morava Bike's start from its depots and finish", () => {
    expect(startPlace(MORAVA_REGULATIONS)).toBe("Dolní Morava");
    expect(startPlace("E1 - Dolní Morava - Olomouc\nMTB etapa")).toBe("Dolní Morava");
    expect(placeRole("Depo Olomouc - ZŠ Svatoplukova, Svatoplukova 65/11")).toBe("depot");
    expect(placeRole("Cíl Bratislava - River Park")).toBe("finish");
    expect(placeRole("se sídlem Babíčkova 1123/6, Olomouc")).toBe("seat");
    expect(placeRole("Start a cíl: náměstí Jablonné v Podještědí")).toBe("start");
    expect(withoutOtherPlaces(MORAVA_REGULATIONS)).not.toMatch(/Olomouc|Bratislava/);
  });

  it("never shows a stage end as the venue", () => {
    expect(quoteIsNotTheStart("Konec E1: Depo Olomouc, ZŠ Svatoplukova, Svatoplukova 65/11")).toBe(true);
    expect(quoteIsNotTheStart("Areál Bohema, Zlaté Hory, občerstvení zajištěno")).toBe(false);
    const stored = { venue: { quote: "Konec E1: Depo Olomouc, ZŠ Svatoplukova, Svatoplukova 65/11", value: { name: "Olomouc, Depo Olomouc, ZŠ Svatoplukova, Svatoplukova 65/11", precision: "venue" }, status: "current", checkedAt: "2026-11-12T07:56:09.174Z", sourceUrl: "https://moravaflow.cz/moravabike/", editionYear: 2027 } };
    expect(practicalDetailsForEvent(stored, "2027-06-19", "2027-06-20").venue).toBeUndefined();
  });

  it("places the race where its first stage starts, not at the first big town on the page", () => {
    const html = `<html><head><title>MORAVABIKE</title></head><body><main><h1>MORAVABIKE</h1><p>Dolní Morava - Bratislava do 24 hod.</p><p>2 depa Olomouc | Hodonín</p><p>V. ročník 19. - 20. 6. 2027</p><p>E1 - Dolní Morava - Olomouc</p><p>Konec E1: Depo Olomouc, ZŠ Svatoplukova</p><p>E2 - Olomouc - Hodonín</p><p>Konec E3: Cíl Bratislava, Riverpark</p></main></body></html>`;
    expect(extractGeneric("https://moravaflow.cz/moravabike/", html)[0]?.placeText).toBe("Dolní Morava");
  });
});
