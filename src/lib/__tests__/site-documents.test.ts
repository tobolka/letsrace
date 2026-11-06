import { describe, expect, it } from "vitest";
import { pdfsInCode, regulationsCandidates, siteOf } from "@/lib/catalog/site-documents";

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
  });
});

describe("a race's own site", () => {
  it("is never a calendar", () => {
    expect(siteOf("https://spsvd.cz/hurecky-krpal/")).toBe("https://spsvd.cz");
    expect(siteOf("https://kalendar.winspace.cz/kalendar/x")).toBeNull();
    expect(siteOf(null)).toBeNull();
  });
});
