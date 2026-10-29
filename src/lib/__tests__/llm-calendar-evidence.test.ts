import { describe, expect, it } from "vitest";
import { pageAsText, verifyRaces } from "@/lib/watcher/extractors/llm-calendar";
const url = "https://club.test/calendar";
const verify = (raw: Parameters<typeof verifyRaces>[0], text: string) => verifyRaces(raw, text, new Set(), url, "2026-01-01");

describe("calendar evidence belongs to one row", () => {
  it("separates an inline date's year from the following caption", () => {
    const { text, links } = pageAsText("<html><body><p>So 8. 5. <span>2027</span><span>Časovka</span></p><p>Archiv 2026</p></body></html>", url);
    expect(text).toContain("2027 Časovka");
    expect(verifyRaces([{ name: "Časovka", start_date: "2027-05-08", quote: "So 8. 5. 2027 Časovka" }], text, links, url, "2026-01-01")).toHaveLength(1);
  });
  it("rejects a race name borrowed from a different row", () => {
    expect(verify([{ name: "Perlcross", start_date: "2026-10-11", quote: "11.10.2026 Anothercross" }], "11.10.2026 Anothercross\n12.10.2026 Perlcross")).toEqual([]);
  });
  it("checks the whole date, including month and year", () => {
    for (const date of ["2026-11-11", "2027-10-11", "2026-02-31"]) {
      expect(verify([{ name: "Perlcross", start_date: date, quote: "11.10.2026 Perlcross" }], "11.10.2026 Perlcross")).toEqual([]);
    }
  });
  it("keeps the race but does not borrow another race's classes, place or discipline", () => {
    const quote = "11.10.2026 Perlcross Perl CX";
    const [race] = verify([{ name: "Perlcross", start_date: "2026-10-11", quote, place: "Berlin", categories: ["U11", "U13"], disciplines: ["cx", "road"] }], `${quote}\n12.10.2026 Roadrace Berlin U11 U13 road`);
    expect(race?.placeText).toBe("");
    expect(race?.ageCategories).toBeUndefined();
    expect(race?.discipline).toEqual(["cx"]);
  });
  it("retains a valid range and season heading", () => {
    const quote = "10.–11.10.2026 Perlcross Perl";
    expect(verify([{ name: "Perlcross", start_date: "2026-10-10", end_date: "2026-10-11", quote, place: "Perl" }], quote)[0]?.endDate).toBe("2026-10-11");
    expect(verify([{ name: "Perlcross", start_date: "2026-10-11", quote: "11.10. Perlcross" }], "Season 2026\n11.10. Perlcross")).toHaveLength(1);
  });

  it("binds a separate date field only to the nearby labelled race name", () => {
    const text = "Závod | Rusavská 50\nPořadatel | SK Rusava\nTermín | 12. 6. 2027\nMísto | Rusava";
    const raw = { name: "Rusavská 50", start_date: "2027-06-12", quote: "Termín | 12. 6. 2027", name_quote: "Závod | Rusavská 50" };
    const [race] = verify([raw], text);
    expect(race?.name).toBe("Rusavská 50");
    expect(race?.evidence?.quote).toContain("Závod | Rusavská 50");
    expect(verify([raw], text.replace("Termín", "Závod | Anothercross\nTermín"))).toEqual([]);
    expect(verify([raw], text.replace("Závod | Rusavská 50", "News about Rusavská 50"))).toEqual([]);
  });

  it("preserves a single-race title when its date is in a separate line", () => {
    const quote = "Termín: 1. 5. 2027 Místo: Choceň - areál koupaliště";
    const [race] = verifyRaces([{ name: "Cyklistickey Race 2027", start_date: "2027-05-01", quote }], quote, new Set(), url, "2026-10-24", "Cyklistickey Race 2027");
    expect(race?.name).toBe("Cyklistickey Race 2027");
    expect(race?.evidence?.quote).toContain("Cyklistickey Race 2027");
    expect(verifyRaces([{ name: "Invented Race", start_date: "2027-05-01", quote }], quote, new Set(), url, "2026-10-24", "Cyklistickey Race 2027")).toEqual([]);
  });

  it("uses a literal local season heading without borrowing a different season", () => {
    const quote = "pátek 26.3. Pražský MTB pohár I. XCC";
    const heading = "Termíny ŠKODA Pražský MTB pohár 2027:";
    const raw = { name: "Pražský MTB pohár I.", start_date: "2027-03-26", quote, series_name: "ŠKODA Pražský MTB pohár 2027", series_quote: heading };
    expect(verify([raw], `${heading}\n${quote}\nArchiv 2026`)).toHaveLength(1);
    expect(verify([raw], `${heading}\nTermíny 2026:\n${quote}`)).toEqual([]);
    expect(verify([raw], `Termíny 2026:\n${quote}\n${heading}`)).toEqual([]);
  });
});

it("does not treat a generic season heading as a race series", () => {
  const quote = "14.11.2026 BL Cyclo Cross Stahnsdorf";
  const [race] = verify([{name:"BL Cyclo Cross Stahnsdorf", start_date:"2026-11-14", quote, series_name:"Termine 2026",series_quote:"Termine 2026"}], `Termine 2026\n${quote}`);
  expect(race?.seriesName).toBeUndefined();
  expect(race?.name).toBe("BL Cyclo Cross Stahnsdorf");
});

it("accepts separate basic facts only with literal race and edition evidence", () => {
  const quote = "Gracia Orlová 29. 4. 2027";
  const facts = "Gracia Orlová je silniční závod. V roce 2027 se koná v České republice.";
  const raw = { name: "Gracia Orlová", start_date: "2027-04-29", quote, disciplines: ["road"], country: "CZ", discipline_quote: facts, country_quote: facts };
  const [race] = verify([raw], `${quote}\n${facts}`);
  expect(race?.discipline).toEqual(["road"]);
  expect(race?.countryHint).toBe("CZ");
  expect(race?.evidence?.quote).toContain(facts);
  for (const invalid of [facts.replace("2027", "2026"), facts.replace("Gracia Orlová", "Another Race"), `${facts} Archiv 2026`]) {
    const [rejected] = verify([{ ...raw, discipline_quote: invalid, country_quote: invalid }], `${quote}\n${invalid}`);
    expect(rejected?.discipline).toBeUndefined();
    expect(rejected?.countryHint).toBeUndefined();
  }
  const [invented] = verify([raw], quote);
  expect(invented?.countryHint).toBeUndefined();
  expect(invented?.discipline).toBeUndefined();
});
