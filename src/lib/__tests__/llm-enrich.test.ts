import { describe, expect, it } from "vitest";
import { candidateLinks, classesInQuote, isListingPage, verifyEnrichment } from "@/lib/catalog/llm-enrich";
import { ageCategoriesFromList } from "@/lib/age-bands";

const text = "Harmonogram zawodów. Kategorie: M2 1997-2007 (19-29 lat). G-Cyclocross Gullegem. Zapisy online do 10.10.2026. Dyscyplina: Przełaj";
const links = [
  { url: "https://zlmtb.com/harmonogram", text: "Harmonogram" },
  { url: "https://zlmtb.com/zapisy", text: "Zapisy" },
  { url: "https://zlmtb.com/regulamin.pdf", text: "Regulamin" },
];

describe("verifyEnrichment", () => {
  it("takes a link only when it is what the model says it is", () => {
    const v = verifyEnrichment(
      { is_this_race: true, registration_url: "https://zlmtb.com/harmonogram", regulations_url: "https://zlmtb.com/regulamin.pdf" },
      text,
      links,
    );
    expect(v.registrationUrl).toBeNull();
    expect(v.regulationsUrl).toBe("https://zlmtb.com/regulamin.pdf");
  });

  it("needs a discipline quote that names the discipline", () => {
    const v = verifyEnrichment(
      { is_this_race: true, disciplines: [{ value: "cx", quote: "Dyscyplina: Przełaj" }, { value: "road", quote: "Harmonogram zawodów" }] },
      text,
      links,
    );
    expect(v.disciplines.map((d) => d.value)).toEqual(["cx"]);
  });

  it("reads ages from the quote, never from the model's label", () => {
    const v = verifyEnrichment({ is_this_race: true, categories: [{ name: "U13", quote: "M2 1997-2007 (19-29 lat)" }, { name: "Elite", quote: "G-Cyclocross" }] }, text, links);
    const ages = ageCategoriesFromList(v.categories.map((c) => ({ name: c.quote })), { refYear: 2026 });
    expect(ages).toEqual(["amateur"]);
  });

  it("keeps an entry deadline only from a quote about entering", () => {
    const ok = verifyEnrichment({ is_this_race: true, entry_closes: { date: "2026-10-10", quote: "Zapisy online do 10.10.2026" } }, text, links);
    expect(ok.entryCloses?.date).toBe("2026-10-10");
  });

  it("splits a quote into its classes and reads bare age ranges", () => {
    const names = ["Platz 1-3 Herren/Damen/Junioren m/w /Senioren", "Men  A 18-34 years", "B 35-42"].flatMap((q) => [q, ...classesInQuote(q)]);
    expect(ageCategoriesFromList(names.map((name) => ({ name })), { refYear: 2027 })).toEqual(["junior", "elite", "amateur", "masters"]);
  });

  it("does not take an early-bird price date for the entry deadline", () => {
    const t = "Poplatek za včasnou registraci (do 19.9.2026) je: 600 Kč";
    expect(verifyEnrichment({ page_about: "this_race", entry_closes: { date: "2026-09-19", quote: t } }, t, []).entryCloses).toBeNull();
  });
});

describe("candidateLinks", () => {
  it("does not let a site's host name pass every link", () => {
    const menu = Array.from({ length: 50 }, (_, i) => `<a href="/seite/${i}/badminton.html">Badminton ${i}</a>`).join("");
    const html = `<nav>${menu}</nav><p><a href="/seite/1/ausschreibung.html">Ausschreibung</a></p>`;
    const links = candidateLinks(html, "http://www.mtb-guentersleben.de/");
    expect(links.map((l) => l.text)).toEqual(["Ausschreibung"]);
  });

  it("keeps an entry platform's link by its host", () => {
    const links = candidateLinks('<a href="https://www.datasport.de/anmeldeservice/x/">hier</a>', "https://perlcross.de/");
    expect(links).toHaveLength(1);
  });
});

describe("isListingPage", () => {
  it("knows a list of events from one race's page", () => {
    expect(isListingPage("https://zpn-timing.de/events/")).toBe(true);
    expect(isListingPage("https://www.czechbmx.cz/category/zavody/propozice/")).toBe(true);
    expect(isListingPage("https://zpn-timing.de/a/789")).toBe(false);
    expect(isListingPage("https://registrace.sportsoft.cz/registration.aspx?e=3661")).toBe(false);
  });
});
