import { describe, expect, it } from "vitest";
import { verifyEnrichment } from "@/lib/catalog/llm-enrich";
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
});
