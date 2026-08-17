import { describe, expect, it } from "vitest";
import {
  attachRegulationsUrl,
  findRegulationsUrl,
  isRegulationsUrl,
  preferRegulationsUrl,
} from "@/lib/watcher/regulations-url";

describe("regulations / propozice links", () => {
  it("recognizes pages and PDFs", () => {
    expect(isRegulationsUrl("https://vangillerncup.cz/wordpress/propozice/")).toBe(true);
    expect(isRegulationsUrl("https://example.cz/wp-content/uploads/2026/propozice-2026.pdf")).toBe(
      true,
    );
    expect(isRegulationsUrl("https://club.de/ausschreibung-2026.pdf")).toBe(true);
    expect(isRegulationsUrl("https://www.pohardrahanskevrchoviny.cz/rozpis/")).toBe(true);
    expect(isRegulationsUrl("https://example.cz/online-prihlasky/")).toBe(false);
    expect(isRegulationsUrl("https://mtbs.cz/clanek/propozice")).toBe(false);
  });

  it("picks a labelled page or PDF from a club homepage", () => {
    const html = `
      <a href="/online-prihlasky/">On-line přihlášky</a>
      <a href="/kategorie/">Rozpis kategorií a propozice</a>
      <a href="/vysledky/">Výsledky</a>
    `;
    expect(findRegulationsUrl("https://www.k-koren.cz/", html)).toBe(
      "https://www.k-koren.cz/kategorie/",
    );

    const pdfHtml = `
      <a href="https://club.cz/startlist">Startovka</a>
      <a href="/files/propozice-2026.pdf">Propozice (PDF)</a>
    `;
    expect(findRegulationsUrl("https://club.cz/", pdfHtml)).toBe(
      "https://club.cz/files/propozice-2026.pdf",
    );
  });

  it("skips privacy pages and homepage self-links labelled propozice", () => {
    const gdpr = `
      <a href="/prohlaseni-o-ochrane-osobnich-udaju/">Pravidla ochrany osobních údajů</a>
      <a href="/files/propozice-2026.pdf">Propozice</a>
    `;
    expect(findRegulationsUrl("https://bikeceladna.cz/", gdpr)).toBe(
      "https://bikeceladna.cz/files/propozice-2026.pdf",
    );

    const self = `<a href="/">Propozice</a><a href="/prihlasky/">Přihlášky</a>`;
    expect(findRegulationsUrl("https://www.spokemaraton.cz/", self)).toBeNull();
  });

  it("does not guess on a calendar with many different PDFs", () => {
    const html = `
      <a href="/r1.pdf">R1</a>
      <a href="/r2.pdf">R2</a>
      <a href="/r3.pdf">R3</a>
      <a href="/r4.pdf">R4</a>
    `;
    expect(findRegulationsUrl("https://cup.cz/kalendar/", html)).toBeNull();
  });

  it("keeps an existing PDF over a later HTML page", () => {
    expect(
      preferRegulationsUrl(
        "https://club.cz/propozice",
        "https://club.cz/files/propozice.pdf",
      ),
    ).toBe("https://club.cz/files/propozice.pdf");
  });

  it("fills parsed events that have no regulations URL yet", () => {
    const html = `<a href="/wordpress/propozice/">Propozice</a>`;
    const events = attachRegulationsUrl("http://vangillerncup.cz/", html, [
      { name: "Van Gillern", regulationsUrl: undefined },
    ]);
    expect(events[0]?.regulationsUrl).toContain("propozice");
  });
});
