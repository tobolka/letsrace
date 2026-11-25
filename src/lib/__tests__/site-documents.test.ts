import { describe, expect, it } from "vitest";
import { fallbackRegulationPaths, htmlRegulationsInCode, pdfsInCode, regulationsCandidates, siteOf } from "@/lib/catalog/site-documents";

describe("PDFs in a page's code", () => {
  it("finds links, embeds and script strings, and resolves relative addresses", () => {
    const html = `<a href="/files/propozice.pdf">x</a><embed src="https://a.cz/b/rozpis.pdf"><script>var f="https:\\/\\/a.cz\\/c\\/pokyny.pdf";</script><iframe src="/viewer?file=x"></iframe>`;
    expect(pdfsInCode(html, "https://a.cz/zavod/").sort()).toEqual(["https://a.cz/b/rozpis.pdf", "https://a.cz/c/pokyny.pdf", "https://a.cz/files/propozice.pdf"]);
  });
  it("finds nothing in a page without any", () => {
    expect(pdfsInCode("<a href='/kontakt'>Kontakt</a>", "https://a.cz/")).toEqual([]);
  });
});

describe("which files may be a race's regulations", () => {
  const race = { name: "Upcycle Trail Weekend", start_date: "2026-11-20" };
  const list = (...urls: string[]) => urls.map(url => ({ url }));
  it("prefers this year's regulations named after the race", () => {
    expect(regulationsCandidates(list("https://a.it/menu-CENA-Upcycle-2025.pdf", "https://a.it/Regolamento-Upcycle-Trail-2025.pdf", "https://a.it/regolamento-upcycle-trail-2026.pdf", "https://a.it/propozice.pdf"), race)).toEqual(["https://a.it/regolamento-upcycle-trail-2026.pdf", "https://a.it/propozice.pdf"]);
  });
  it("leaves out forms, results and posters", () => {
    expect(regulationsCandidates(list("https://a.cz/Certificato-Modello-C.pdf", "https://a.de/Aufnahmeantrag.pdf", "https://a.cz/ergebnis-upcycle.pdf", "https://a.cz/plakat-upcycle.pdf"), race)).toEqual([]);
    // A club's newsletter mentions the race and is not its regulations (Stahlrad Laatzen, 11 Nov 2026).
    expect(regulationsCandidates(list("https://a.de/Depesche-02.2026-upcycle.pdf", "https://a.cz/zpravodaj-upcycle-2026.pdf", "https://a.de/Newsletter-Upcycle-2026.pdf"), race)).toEqual([]);
  });
});

describe("HTML regulations pages in a site's code", () => {
  it("finds HTML regulations links by path (even under 'O závodu') and by link text", () => {
    const scorelaufHtml = `<nav><a href="https://www.scorelauf.cz/index.php/propozice/">O závodu</a><a href="/kontakt/">Kontakt</a></nav>`;
    expect(htmlRegulationsInCode(scorelaufHtml, "https://scorelauf.cz/")).toEqual([
      { url: "https://www.scorelauf.cz/index.php/propozice/", label: "O závodu" },
    ]);
    const vesnicaniHtml = `<nav><a href="https://www.vesnicani.cz/kruzberk-sport-series/">Schuter cup – Propozice</a><a href="https://www.vesnicani.cz/vysledky/">Výsledky</a></nav>`;
    expect(htmlRegulationsInCode(vesnicaniHtml, "https://www.vesnicani.cz/")).toEqual([
      { url: "https://www.vesnicani.cz/kruzberk-sport-series/", label: "Schuter cup – Propozice" },
    ]);
  });
  it("includes the race's own page when it embeds a Propozice heading directly", () => {
    const html = `<main><h2>Propozice</h2><div>Kategorie</div></main>`;
    expect(htmlRegulationsInCode(html, "https://bavsesportem.cz/cyklistickey-race/")).toEqual([
      { url: "https://bavsesportem.cz/cyklistickey-race/", label: "propozice" },
    ]);
  });
  it("scores trailing-slash HTML regulations URLs and link labels", () => {
    const docs = [
      { url: "https://www.scorelauf.cz/index.php/propozice/", label: "O závodu" },
      { url: "https://www.vesnicani.cz/kruzberk-sport-series/", label: "Schuter cup – Propozice" },
    ];
    expect(regulationsCandidates(docs, { name: "Miletínský Scorelauf", start_date: "2027-09-04" })[0]).toBe("https://www.scorelauf.cz/index.php/propozice/");
    expect(regulationsCandidates(docs, { name: "Kružberský Schuter Cup #1", start_date: "2027-04-04" })[0]).toBe("https://www.vesnicani.cz/kruzberk-sport-series/");
  });
  it("picks language-appropriate fallback regulations paths by site TLD", () => {
    expect(fallbackRegulationPaths("https://www.dokolamtb.cz")).toEqual(["/propozice/", "/rozpis/"]);
    expect(fallbackRegulationPaths("https://www.maraton.sk")).toEqual(["/propozicie/", "/propozice/"]);
    expect(fallbackRegulationPaths("https://www.race.de")).toEqual(["/ausschreibung/", "/reglement/"]);
    expect(fallbackRegulationPaths("https://www.wyscig.pl")).toEqual(["/regulamin/"]);
    expect(fallbackRegulationPaths("https://www.gara.it")).toEqual(["/regolamento/"]);
    expect(fallbackRegulationPaths("https://www.dirka.si")).toEqual(["/razpis/"]);
    expect(fallbackRegulationPaths("https://www.verseny.hu")).toEqual(["/versenykiiras/"]);
  });
});

describe("a race's own site", () => {
  it("is never a calendar", () => {
    expect(siteOf("https://spsvd.cz/hurecky-krpal/")).toBe("https://spsvd.cz");
    expect(siteOf("https://kalendar.winspace.cz/kalendar/x")).toBeNull();
    expect(siteOf(null)).toBeNull();
  });
});
