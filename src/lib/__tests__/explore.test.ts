import { describe, expect, it } from "vitest";
import {
  canonicalExploreUrl,
  looksLikeIndependentRaceUrl,
  scoreRacePage,
  shouldAutoWatch,
} from "@/lib/watcher/explore";
import { parseVanGillern } from "@/lib/watcher/extractors/cz-calendars";

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
    expect(events[0]?.lat).toBeCloseTo(49.889, 2);
    expect(events[0]?.lng).toBeCloseTo(14.565, 2);
  });
});
