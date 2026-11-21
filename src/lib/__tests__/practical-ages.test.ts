import { describe, expect, it } from "vitest";
import { regulationAgePatch, regulationAges } from "@/lib/catalog/practical-ages";

const list = (key: "categories" | "fees" | "schedule", labels: string[], editionYear = 2026) => ({
  [key]: { status: "current", editionYear, value: labels.map((label) => ({ label, sourceUrl: "https://example.org/propozice.pdf" })) },
});

describe("age classes from the regulations", () => {
  it("drops guessed children when the youth ladder starts at U13 (NoLimited cup)", () => {
    const read = regulationAges(list("schedule", ["Masters A, B, C + women Masters", "U13 men + U15 women", "U15 men + U17 women", "U17 men + Women Juniors", "Men Juniors", "Women elite", "Men Elite (+ U23)"]), 2026);
    const patch = regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite", "masters"]);
    expect(patch?.age_confidence).toBe("explicit");
  });

  it("takes a race's own category list as final: no guessed elite beside it, confirmed (Mem. Cyrila Schejbala)", () => {
    const read = regulationAges(list("categories", ["Junioři a Juniorky U19/WU19", "Kadeti a Kadetky U17/WU17", "Žáci st. U15", "Žákyně WU15/WU13", "Žáci ml. U13"]), 2026);
    expect(read?.ownList).toBe(true);
    const patch = regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "u17", "youth", "junior"]);
    expect(patch?.age_confidence).toBe("explicit");
  });

  it("does not flip back: an own write with extra classes is corrected to the list, and the list then stays", () => {
    const read = regulationAges(list("categories", ["Junioři a Juniorky U19/WU19", "Kadeti a Kadetky U17/WU17", "Žáci st. U15", "Žáci ml. U13"]), 2026);
    const first = regulationAgePatch({ age_categories: ["u13", "u15", "u17", "youth", "junior", "u23", "elite"], age_confidence: "explicit" }, read, true)!;
    expect(first.age_categories).toEqual(["u13", "u15", "u17", "youth", "junior"]);
    expect(regulationAgePatch({ age_categories: first.age_categories, age_confidence: first.age_confidence }, read, true)).toBeNull();
  });

  it("keeps the elite when only the timetable names the youth classes, and does not confirm it", () => {
    const read = regulationAges(list("schedule", ["Junioři", "Kadeti", "Žáci st. U15", "Žáci ml. U13"]), 2026);
    expect(read?.ownList).toBe(false);
    const patch = regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite"]);
    expect(patch?.age_confidence).toBe("default");
  });

  it("keeps the adults of a marathon whose fees are priced by course", () => {
    const read = regulationAges({ ...list("categories", ["Mladší žiaci", "Starší žiaci"], 2027), ...list("fees", ["90 km MTB", "30 km MTB"], 2027) }, 2027);
    expect(read?.byCourse).toBe(true);
    const patch = regulationAgePatch({ age_categories: ["kids", "amateur", "masters"], age_confidence: "default" }, read);
    expect(patch?.age_categories).toEqual(["u13", "u15", "kids", "youth", "amateur", "masters"]);
  });

  it("takes the own list as final when it names both ends of the field, though the fees are priced by course (Rohanské stezky)", () => {
    const details = {
      categories: { status: "current", editionYear: 2027, value: [
        { label: "Junioři", birthYears: "2009 a mladší" }, { label: "Ženy 19-39", birthYears: "1988-2008" }, { label: "Ženy 40+", birthYears: "1987 a dříve" },
        { label: "Muži 19-29", birthYears: "1998-2008" }, { label: "Muži 40-49", birthYears: "1978-1987" }, { label: "Muži 60+", birthYears: "1967 a dříve" },
        { label: "Žáci a žákyně starší", birthYears: "2013–2014" }, { label: "Žáci a žákyně mladší", birthYears: "2015–2016" },
        { label: "Předžáci a předžákyně", birthYears: "2017–2018" }, { label: "Minižáci a minižákyně", birthYears: "2019–2020" }] },
      ...list("fees", ["25 km, platba do 31. 3. 2027", "50 km, na místě"], 2027),
    };
    const read = regulationAges(details, 2027);
    expect(read?.byCourse).toBe(true);
    expect(read?.coversWholeField).toBe(true);
    const patch = regulationAgePatch({ age_categories: ["u7", "u9", "u11", "u13", "u15", "u17", "kids", "youth", "junior", "elite", "amateur", "masters"], age_confidence: "default" }, read);
    expect(patch?.age_confidence).toBe("explicit");
    expect(patch?.age_categories).not.toContain("u17");
    expect(regulationAgePatch({ age_categories: patch!.age_categories, age_confidence: "explicit" }, read, true)).toBeNull();
  });

  it("does not take a list as the whole field when a line of it is not understood or it is a two-line description", () => {
    const fees = list("fees", ["Elite, U23, Amateure, Bike Card", "Master", "Mini"], 2026);
    const table = regulationAges({ ...list("categories", ["R1 WU17+MU15", "R2 WU15+MU13+WU13", "R3 AM, MA, Fr-Nat, BC", "R4 MU17", "R9 ME UCI C2", "Master", "Mini"]), ...fees }, 2026);
    expect(table?.coversWholeField).toBe(false);
    const prose = regulationAges({ ...list("categories", ["Erwachsene, Jugendliche & Kinder ab 6 Jahre", "Volljährige, d.h. Frauen und Männer mit und ohne Rennlizenz (Kategorie: Jedermann)"], 2027), ...list("fees", ["Einzelzeitfahren: 10km"], 2027) }, 2027);
    expect(prose?.coversWholeField).toBe(false);
  });

  it("does not take a list of one end as the whole field just because it is long", () => {
    const read = regulationAges({ ...list("categories", ["Muži 19-39", "Muži 40+", "Ženy"], 2027), ...list("fees", ["90 km MTB", "30 km MTB"], 2027) }, 2027);
    expect(read?.byCourse).toBe(true);
    expect(read?.coversWholeField).toBe(false);
    expect(regulationAgePatch({ age_categories: ["kids", "amateur", "masters"], age_confidence: "default" }, read)?.age_categories).toContain("kids");
  });

  it("drops a guessed open class a race's own list does not name", () => {
    const ladder = regulationAges(list("categories", ["Junioři", "Muži Elite", "Ženy Elite"]), 2026);
    const patch = regulationAgePatch({ age_categories: ["junior", "elite", "amateur"], age_confidence: "default" }, ladder);
    expect(patch?.age_categories).toEqual(["junior", "elite"]);
    expect(patch?.age_confidence).toBe("explicit");
  });

  it("puts the race's own list above a set another source confirmed", () => {
    const read = regulationAges(list("categories", ["Junioři", "Muži Elite"]), 2026);
    const patch = regulationAgePatch({ age_categories: ["kids", "junior", "elite", "amateur"], age_confidence: "explicit" }, read);
    expect(patch?.age_categories).toEqual(["junior", "elite"]);
    expect(regulationAgePatch({ age_categories: ["junior", "elite"], age_confidence: "explicit" }, read)).toBeNull();
  });

  it("places a class by its name before the birth years read beside it (Janev Cup)", () => {
    const details = { categories: { status: "current", editionYear: 2026, value: [
      { label: "MUŽI", birthYears: "2008" }, { label: "JUNIOŘI", birthYears: "2009-2010" }, { label: "KADETI", birthYears: "2011-2012" },
      { label: "STARŠÍ ŽÁCI", birthYears: "2013-2014" }, { label: "MLADŠÍ ŽÁCI", birthYears: "2015-2017" }] } };
    const read = regulationAges(details, 2026);
    expect(read?.ages).toEqual(["u13", "u15", "u17", "youth", "junior", "elite"].concat([]));
    expect(regulationAgePatch({ age_categories: ["kids", "youth", "junior", "u23", "elite"], age_confidence: "default" }, read)?.age_categories)
      .toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite"]);
  });

  it("ignores another edition's regulations", () => {
    expect(regulationAges(list("categories", ["Junioři", "Muži Elite"], 2025), 2026)).toBeNull();
  });
});
