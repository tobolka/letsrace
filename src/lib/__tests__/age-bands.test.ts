import { describe, expect, it } from "vitest";
import { ageCategoriesFromList } from "@/lib/age-bands";

const names = (list: string[]) => ageCategoriesFromList(list.map((name) => ({ name })));

describe("ageCategoriesFromList", () => {
  it("reads Sumator classes by their stated ages", () => {
    expect(
      ageCategoriesFromList([
        { name: "KI - kadeti, 15 - 16 let (2010 - 2011)", ageMin: 15, ageMax: 16 },
        { name: "A - muži, 19 - 29 let (1997 - 2007)", ageMin: 19, ageMax: 29 },
        { name: "E - muži, 60 a více let ( 1966 a starší)", ageMin: 60 },
        { name: "SI - starší žáci, 0 - 14 let (2012 a mladší )", ageMin: 0, ageMax: 14 },
      ]),
    ).toEqual(["u15", "u17", "youth", "amateur", "masters"]);
  });

  it("reads the Czech federation's class names", () => {
    expect(
      names([
        "Elite", "Junior", "Juniorky", "Kadeti", "Kadetky", "Masters", "U23",
        "Žáci - mladší", "Žáci - starší", "Žákyně - starší", "Ženy", "Žákyně - mladší",
      ]),
    ).toEqual(["u13", "u15", "u17", "kids", "youth", "junior", "u23", "elite", "masters"]);
  });

  it("reads kids' classes and bare BMX ages", () => {
    expect(names(["Odrážedla", "Předžáci"])).toEqual(["u7", "u9", "u11", "kids"]);
    expect(names(["Boys 9-10", "Girls 7 a mladší"])).toEqual(["u9", "u11", "kids"]);
    expect(names(["U11", "U 15"])).toEqual(["u11", "u15", "kids", "youth"]);
  });

  it("adds nothing for a list that says nothing about age", () => {
    expect(names(["26 km", "13 km", "Jesenický šnek trasa 3 km"])).toEqual([]);
  });

  it("reads the forms' abbreviations and ignores what is not a class", () => {
    expect(names(["Ml. žáci", "st. žákyně"])).toEqual(["u13", "u15", "kids", "youth"]);
    expect(names(["pro ostatní kategorie", "- nejmladší", "Kategorie od 6ti let"])).toEqual([]);
  });

  it("reads birth years as ages in the race's season", () => {
    expect(
      ageCategoriesFromList(
        [{ name: "Kadeti 2011–2012" }, { name: "Žáci starší 2013 a mladší" }, { name: "Muži E 1966 a starší" }],
        { refYear: 2026 },
      ),
    ).toEqual(["u15", "u17", "youth", "masters"]);
  });

  it("reads ages written out in the name", () => {
    expect(names(["muži 15-35 let", "muži 36 let -60 let", "Mini 4-5 let"])).toEqual(["u7", "kids", "amateur", "masters"]);
  });
});
