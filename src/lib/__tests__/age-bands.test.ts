import { describe, expect, it } from "vitest";
import { ageCategoriesFromList } from "@/lib/age-bands";

it("reads Wood Bikerally's birth-year upper and lower directions", () => {
  expect(ageCategoriesFromList([{ name: "Střelci ročník 2012 – a výš" }], { refYear: 2026 })).toEqual(["u7", "u9", "u11", "u13", "u15", "kids", "youth"]);
  expect(ageCategoriesFromList([{ name: "Legendy ročník 1981 a níže" }], { refYear: 2026 })).toEqual(["masters"]);
});

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
    ).toEqual(["u7", "u9", "u11", "u13", "u15", "u17", "kids", "youth", "amateur", "masters"]);
  });

  it("reads the Czech federation's class names", () => {
    expect(
      names([
        "Elite", "Junior", "Juniorky", "Kadeti", "Kadetky", "Masters", "U23",
        "Žáci - mladší", "Žáci - starší", "Žákyně - starší", "Ženy", "Žákyně - mladší",
      ]),
    ).toEqual(["u13", "u15", "u17", "youth", "junior", "u23", "elite", "masters"]);
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
    expect(names(["Ml. žáci", "st. žákyně"])).toEqual(["u13", "u15", "youth"]);
    expect(names(["pro ostatní kategorie", "- nejmladší", "Kategorie od 6ti let"])).toEqual([]);
  });

  it("reads birth years as ages in the race's season", () => {
    expect(
      ageCategoriesFromList(
        [{ name: "Kadeti 2011–2012" }, { name: "Žáci starší 2013 a mladší" }, { name: "Muži E 1966 a starší" }],
        { refYear: 2026 },
      ),
    ).toEqual(["u7", "u9", "u11", "u13", "u15", "u17", "kids", "youth", "masters"]);
  });

  it("reads ages written out in the name", () => {
    expect(names(["muži 15-35 let", "muži 36 let -60 let", "Mini 4-5 let"])).toEqual(["u7", "u17", "kids", "youth", "junior", "amateur", "masters"]);
  });
});

describe("other federations' class names", () => {
  it("reads tight birth-year ranges and every admitted child band", () => {
    expect(ageCategoriesFromList([{ name: "Mini Kids Jahrgang 2016-2019" }, { name: "Kids Jahrgang 2011-2015" }], { refYear: 2026 }))
      .toEqual(["u9", "u11", "u13", "u15", "u17", "kids", "youth"]);
  });
  it("does not turn an adult birth-year ceiling into one exact age", () => {
    expect(ageCategoriesFromList([{ name: "Damen bis 2010" }], { refYear: 2026 })).toEqual(expect.arrayContaining(["u17", "youth", "junior", "amateur"]));
    // The admitted 18-year-olds also need to match the junior age filter.
    expect(ageCategoriesFromList([{ name: "Erwachsene ab 1987" }], { refYear: 2026 })).toEqual(["junior", "amateur"]);
  });
  it("places Italian, Dutch, Polish and French youth classes", async () => {
    const { ageCategoriesFromList } = await import("@/lib/age-bands");
    const one = (n: string) => ageCategoriesFromList([{ name: n }], { refYear: 2026 }).filter((a) => a !== "kids" && a !== "youth");
    expect(one("Esordienti")).toEqual(["u13", "u15"]);
    expect(one("Allievi")).toEqual(["u17"]);
    expect(one("Nieuwelingen")).toEqual(["u17"]);
    expect(one("Młodzik")).toEqual(["u15"]);
    expect(one("Juniores")).toEqual(["junior"]);
    expect(one("Hobby Frauen")).toEqual(["amateur"]);
    expect(one("Elite e Under 23")).toEqual(["u23"]);
  });
});

it("keeps every admitted child band for an open upper age limit", () => {
  expect(names(["kluci do 8 let"])).toEqual(["u7", "u9", "kids"]);
  expect(ageCategoriesFromList([{name:"2018 a mladší"}],{refYear:2026})).toEqual(["u7","u9","kids"]);
  expect(names(["Laufradrennen"])).toEqual(["kids"]);
});
