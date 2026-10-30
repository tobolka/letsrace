import { describe, expect, it } from "vitest";
import { nakoleListings, parseNakoleDetail } from "@/lib/watcher/extractors/nakole";
import { extractEvents, canReconcileMissingEvents } from "@/lib/watcher/core";

const url = "https://www.nakole.cz/akce/3281-prazska-padesatka-2026.html";
const detail = (description = "Tradiční závod horských kol pro širokou veřejnost.", type = "Závod", date = "19.09.2026", place = "Praha, Dejvice") => `<div id="sloupec_500"><div id="clanek">
  <h1>Pražská padesátka 2026</h1><h2>${type}</h2>
  <p class="fl"><strong>Termín:</strong> ${date}, 08:00h - ${date}, 16:00h<br><strong>Místo:</strong> ${place}<br></p>
  <p>${description}</p><h2>Pořadatel</h2><p>Klub<br><strong>Kontakt:</strong> <a href="https://prazska50.cz">web</a></p>
  <div id="seznamZajezdu"><h3>MTB vyjížďka 2027</h3></div></div></div>`;

describe("NaKole race-only reader", () => {
  it("reads only the detail's own identity, date, venue and organiser link", () => {
    expect(parseNakoleDetail(url, detail()).event).toMatchObject({ externalId: "nakole-3281", name: "Pražská padesátka 2026",
      startDate: "2026-09-19", placeText: "Praha, Dejvice", discipline: ["mtb"], websiteUrl: "https://prazska50.cz/", eventType: "race" });
  });
  it.each(["Vyjížďka / sraz", "Beseda", "Výstava", "Konference / seminář"])("rejects %s despite race words", type => {
    expect(parseNakoleDetail(url, detail("MTB závod", type)).event).toBeUndefined();
  });
  it.each(["Běžecký závod", "Nezávodní jízda na horských kolech", "MTB akce bez měření času", "Triatlon s cyklistickou částí"])("rejects mislabelled %s", text => {
    expect(parseNakoleDetail(url, detail(text)).event).toBeUndefined();
  });
  it("does not use cycling evidence from related events", () => {
    expect(parseNakoleDetail(url, detail("Běžecký závod")).reason).toBe("cycling_not_proven");
  });
  it("validates real dates", () => {
    expect(parseNakoleDetail(url, detail(undefined, undefined, "31.02.2026")).reason).toBe("invalid_date");
  });
  it("preserves explicit foreign country", () => {
    expect(parseNakoleDetail(url, detail(undefined, undefined, undefined, "Wien (AT)")).event?.countryHint).toBe("AT");
  });
  it("only reads list rows from the main listing", () => {
    const item = `<div class="item"><div class="popis"><h3><a href="/akce/3281-race.html">Závod</a></h3><div class="mb5">závod - Praha</div></div><div class="datum2">19.09.2026</div></div>`;
    expect(nakoleListings(`<div id="sloupec_500"><div id="seznamZajezdu">${item}</div></div><aside id="seznamZajezdu">${item}</aside>`)).toHaveLength(1);
  });
  it("cannot fall back to generic/AI parsing of an excluded detail", async () => {
    const result = await extractEvents(url, detail("MTB závod", "Vyjížďka / sraz"));
    expect(result.events).toEqual([]);
    expect(result.strategy).toBe("adapter:nakole");
  });
  it("never hides backfilled races as the archive's first page moves", () => {
    expect(canReconcileMissingEvents({ events: [], strategy: "adapter:nakole", childUrls: [], confidence: 1 })).toBe(false);
  });
});
