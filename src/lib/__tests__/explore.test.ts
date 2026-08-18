import { describe, expect, it } from "vitest";
import {
  canonicalExploreUrl,
  looksLikeIndependentRaceUrl,
  pickExplorePacks,
  scoreRacePage,
  shouldAutoWatch,
} from "@/lib/watcher/explore";
import { parseVanGillern, parseKonarovickyKoren, parseJesenickySnek, parseBratislavaMtbMaraton } from "@/lib/watcher/extractors/cz-calendars";

describe("race website explorer", () => {
  it("canonicalizes WordPress homes to the origin", () => {
    expect(canonicalExploreUrl("http://vangillerncup.cz/wordpress/?utm_source=fb")).toBe(
      "http://vangillerncup.cz",
    );
    expect(canonicalExploreUrl("https://www.Example-Cup.cz/cs/")).toBe("https://example-cup.cz");
  });

  it("recognizes independent race hosts like vangillerncup.cz", () => {
    expect(looksLikeIndependentRaceUrl("http://vangillerncup.cz")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://skvelopraha.cz/velky-haj/")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://alpen-cup.at/rennen")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://schwarzwald-rennen.de")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://tatry-mtb.sk/preteky")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://puchar-beskid.pl/zapisy")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://granfondo-lago.it/iscrizioni")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://www.k-koren.cz")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://jesenickysnek.cz")).toBe(true);
    expect(looksLikeIndependentRaceUrl("https://hynekmusil.cz/?serialosss=tc")).toBe(false);
    expect(looksLikeIndependentRaceUrl("https://federciclismo.it/calendario")).toBe(false);
    expect(looksLikeIndependentRaceUrl("https://facebook.com/some-race")).toBe(false);
  });

  it("scores a small cup homepage as a race site", () => {
    const html = `
      <html><head><title>Van Gillern Cup 2026</title></head>
      <body>
        <h1>Van Gillern Cup 2026</h1>
        <p>Neděle 6.září 2026 MTB XC závod. Upraveny propozice a byla spuštěna registrace.</p>
      </body></html>
    `;
    const { score, reasons } = scoreRacePage("http://vangillerncup.cz", html);
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(reasons).toEqual(expect.arrayContaining(["host", "title", "date", "entry"]));
  });

  it("scores a German club race page", () => {
    const html = `
      <html><head><title>Schwarzwald MTB Cup 2026</title></head>
      <body>
        <h1>Schwarzwald MTB Rennen</h1>
        <p>Sonntag 12. September 2026. Anmeldung und Ausschreibung sind online.</p>
      </body></html>
    `;
    const { score, reasons } = scoreRacePage("https://schwarzwald-rennen.de", html);
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(reasons).toEqual(expect.arrayContaining(["host", "title", "date", "entry"]));
    expect(shouldAutoWatch({ score, reasons })).toBe(true);
  });

  it("does not auto-watch a titled club page without a date", () => {
    const html = `
      <html><head><title>Alpen MTB Cup</title></head>
      <body><h1>Alpen MTB Cup</h1><p>Registrace a propozice brzy.</p></body></html>
    `;
    const { score, reasons } = scoreRacePage("https://alpen-cup.at/rennen", html);
    expect(shouldAutoWatch({ score, reasons })).toBe(false);
  });

  it("parses Van Gillern Cup 2026 from the homepage", () => {
    const html = `
      <html><head><title>Van Gillern Cup 2026</title></head>
      <body>
        <h1>Van Gillern Cup 2026</h1>
        <p>Neděle 6.září</p>
        <p>Upraveny propozice a byla spuštěna registrace</p>
        <a href="https://online.eztiming.eu/prihlasky/vgc2026/">Registrace</a>
      </body></html>
    `;
    const events = parseVanGillern("http://vangillerncup.cz", html);
    expect(events).toHaveLength(1);
    expect(events[0]?.startDate).toBe("2026-09-06");
    expect(events[0]?.registrationUrl).toContain("eztiming.eu");
    expect(events[0]?.regulationsUrl).toContain("propozice");
    expect(events[0]?.lat).toBeCloseTo(49.889, 2);
    expect(events[0]?.lng).toBeCloseTo(14.565, 2);
  });

  it("parses Konárovický kořen 2026 from the homepage, not the signup deadline", () => {
    const html = `
      <html><head><title>Konárovický kořen</title></head>
      <body>
        <h1>Konárovický kořen</h1>
        <p>Těšíme se na vás 27. září 2026 na 26. ročníku!</p>
        <p>Tradiční cyklistický závod na horských kolech.</p>
        <a href="/online-prihlasky/">On-line přihlášky</a>
      </body></html>
    `;
    const events = parseKonarovickyKoren("https://www.k-koren.cz/", html);
    expect(events).toHaveLength(1);
    expect(events[0]?.startDate).toBe("2026-09-27");
    expect(events[0]?.registrationUrl).toContain("online-prihlasky");
    expect(events[0]?.regulationsUrl).toContain("kategorie");
    expect(events[0]?.lat).toBeCloseTo(50.041, 2);
  });

  it("parses Jesenický šnek homepage cards and skips news timestamps", () => {
    const html = `
      <html><body>
        <h3>Aktuality</h3>
        <time dateTime="2026-08-11T13:32:31+00:00">2026-08-11</time>
        <p>O cenu Rapotína - předběžné výsledky</p>
        <a href="/event/149">
          <h3>XC Hynčice</h3>
          <h5><time dateTime="2026-08-22">2026-08-22</time><span>, </span><span>Hynčice pod Sušinou</span></h5>
          <p>MTB, Jesenický šneček</p>
        </a>
        <a href="/event/152">
          <h4>Českopetrovická koolna</h4>
          <h5><time dateTime="2026-09-05">2026-09-05</time><span>, </span><span>České Petrovice</span></h5>
        </a>
        <a href="/event/153">
          <h4>XC Loko Krnov</h4>
          <h5><time dateTime="2026-09-12">2026-09-12</time><span>, </span><span>Krnov</span></h5>
        </a>
      </body></html>
    `;
    const events = parseJesenickySnek("https://jesenickysnek.cz/", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2026-08-22 XC Hynčice",
      "2026-09-05 Českopetrovická koolna",
      "2026-09-12 XC Loko Krnov",
    ]);
    expect(events[0]?.websiteUrl).toBe("https://jesenickysnek.cz/event/149");
    expect(events[0]?.seriesSlug).toBe("jesenicky-snek");
    expect(events[0]?.regulationsUrl).toContain("snek2026.pdf");
  });

  it("parses a Jesenický šnek event page registration form", () => {
    const html = `
      <html><body>
        <h3>XC Hynčice</h3>
        <p>2026-08-22, Hynčice pod Sušinou</p>
        <time dateTime="2026-08-22">2026-08-22</time>
        <span>Hynčice pod Sušinou</span>
        <a href="https://docs.google.com/forms/d/e/abc/viewform">PŘIHLÁŠKY</a>
      </body></html>
    `;
    const events = parseJesenickySnek("https://jesenickysnek.cz/event/149", html);
    expect(events).toHaveLength(1);
    expect(events[0]?.registrationUrl).toContain("docs.google.com/forms");
    expect(events[0]?.websiteUrl).toContain("/event/149");
  });

  it("keeps Bratislava MTB marathon and kids loop as separate pins", () => {
    const stamp = `<span class="date-display-single">nedeľa, 27.09.2026, 10:00</span>`;
    const kids = parseBratislavaMtbMaraton(
      "https://bratislavskymtbmaraton.biker.sk/preteky/detske-preteky-2026",
      `<html><body>${stamp}<p>Letného kúpaliska v Knižkovej doline</p></body></html>`,
    );
    const marathon = parseBratislavaMtbMaraton(
      "https://bratislavskymtbmaraton.biker.sk/preteky/maraton",
      `<html><body>${stamp}<p>Bratislava Rača - Amfiteáter</p></body></html>`,
    );
    expect(kids[0]?.startDate).toBe("2026-09-27");
    expect(kids[0]?.audience).toBe("kids");
    expect(kids[0]?.discipline).toEqual(["xco"]);
    expect(marathon[0]?.discipline).toEqual(["xcm"]);
    expect(kids[0]?.externalId).not.toBe(marathon[0]?.externalId);
    expect(kids[0]?.childUrls?.some((u) => /\/maraton$/.test(u))).toBe(true);
    expect(marathon[0]?.childUrls?.some((u) => /detske-preteky/.test(u))).toBe(true);
  });

  it("weights explorer packs toward home markets and sniffs Italy every third window", () => {
    const home = pickExplorePacks(1);
    expect(home.every((p) => p.id !== "it")).toBe(true);
    expect(home.length).toBe(2);
    const withItaly = pickExplorePacks(3);
    expect(withItaly.some((p) => p.id === "it")).toBe(true);
    expect(withItaly.some((p) => p.id === "ch" || p.id === "cz" || p.id === "de")).toBe(true);
  });
});
