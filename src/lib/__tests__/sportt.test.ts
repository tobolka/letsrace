import { describe, expect, it } from "vitest";
import {
  isSporttHost,
  parseSporttRaces,
  sporttDiscipline,
  sporttPlace,
  type SporttRace,
} from "@/lib/watcher/extractors/sportt";

/** Every record below is one the API returned for the 2026 autumn. */
const RECORDS: SporttRace[] = [
  {
    id: 1548,
    name: "RI OKNA MAŘENICE-CHATA LUŽ 2026 (Silniční časovka do vrchu)",
    date: [2026, 9, 9],
    web: "https://ccvarnsdorf.xf.cz/Data/PROPOZICE_RIOKNACHATALUZ_2026.pdf",
    raceFee: 80,
  },
  { id: 1539, name: "Kraslické dny cyklistiky - Závod do vrchu 2026", date: [2026, 9, 19], web: "" },
  { id: 1540, name: "Kraslické dny cyklistiky - Kraslický šíp 2026", date: [2026, 9, 20], web: "" },
  { id: 1524, name: "ELIMON MARATON STŘÍŽÁK II 2026", date: [2026, 9, 27], web: "http://www.ustimtbcup.cz/" },
  { id: 1530, name: "Trmická desítka za Přemyslem Oráčem 2026", date: [2026, 9, 12], web: "http://www.trmickadesitka.cz/" },
  { id: 1528, name: "Miranovy duby 2026 - Prague City golf Vinoř", date: [2026, 9, 19], web: "" },
  { id: 1537, name: "ŠumpeRUN 2026", date: [2026, 9, 26], web: "https://www.sumperun.cz/propozice-d15.html" },
  { id: 1499, name: "Plzeňský Kardioběh 2026", date: [2026, 9, 26], web: "https://www.pro-sport.cz/" },
  { id: 1550, name: "ROLLO LIGA 2026 – 4. kolo Mikulovice", date: [2026, 9, 20], web: "" },
  { id: 9999, name: "TEST", date: [2030, 12, 31], web: "" },
];

describe("sporttDiscipline", () => {
  it("takes a race the name says is ridden", () => {
    expect(sporttDiscipline("Kraslické dny cyklistiky - Závod do vrchu 2026", "")).toEqual(["mtb"]);
    expect(
      sporttDiscipline("RI OKNA MAŘENICE-CHATA LUŽ 2026 (Silniční časovka do vrchu)", ""),
    ).toEqual(["road"]);
  });

  it("takes a race whose organiser's address says it", () => {
    // "Maraton" alone is a running word as often as a bike one.
    expect(sporttDiscipline("ELIMON MARATON STŘÍŽÁK II 2026", "http://www.ustimtbcup.cz/")).toEqual([
      "mtb",
    ]);
    expect(sporttDiscipline("ELIMON MARATON STŘÍŽÁK II 2026", "")).toBeNull();
  });

  it("leaves the rest of the platform alone", () => {
    // A blanket "is this another sport" gate keeps all three of these.
    expect(sporttDiscipline("ŠumpeRUN 2026", "https://www.sumperun.cz/")).toBeNull();
    expect(sporttDiscipline("Miranovy duby 2026 - Prague City golf Vinoř", "")).toBeNull();
    expect(sporttDiscipline("Plzeňský Kardioběh 2026", "https://www.pro-sport.cz/")).toBeNull();
    expect(sporttDiscipline("ROLLO LIGA 2026 – 4. kolo Mikulovice", "")).toBeNull();
  });
});

describe("sporttPlace", () => {
  it("reads a town out of the adjective it makes", () => {
    expect(sporttPlace("Kraslické dny cyklistiky - Závod do vrchu 2026")).toBe("Kraslice");
    expect(sporttPlace("Blanenská desítka")).toBeNull();
  });

  it("does not take the sponsor for the village", () => {
    // "RI OKNA" is a window company; Mařenice is the village. Picking the
    // longest or the second capitalised word is guessing at marketing copy.
    expect(sporttPlace("RI OKNA MAŘENICE-CHATA LUŽ 2026 (Silniční časovka do vrchu)")).toBeNull();
  });

  it("says nothing rather than a wrong town", () => {
    expect(sporttPlace("TEST")).toBeNull();
    expect(sporttPlace("Memoriál 2026")).toBeNull();
    expect(sporttPlace("České dny cyklistiky")).toBeNull();
  });
});

describe("parseSporttRaces", () => {
  const events = parseSporttRaces(RECORDS);

  it("keeps only the races it can show are bike races", () => {
    // Cycling and placeable. The Mařenice time trial and the Střížák marathon
    // are bike races too, but this source says where neither of them is.
    expect(events.map((e) => e.name)).toEqual([
      "Kraslické dny cyklistiky - Závod do vrchu 2026",
      "Kraslické dny cyklistiky - Kraslický šíp 2026",
    ]);
  });

  it("gives every one of them the entry link the platform is", () => {
    expect(events[0]!.registrationUrl).toBe("https://sportt.cz/race/1539");
    expect(events[0]!.sourceUrl).toBe("https://sportt.cz/race/1539");
  });

  it("reads the date the API states as three numbers", () => {
    expect(events[0]!.startDate).toBe("2026-09-19");
    expect(events[1]!.startDate).toBe("2026-09-20");
  });

  it("does not offer a PDF of the regulations as the race's website", () => {
    expect(parseSporttRaces([RECORDS[0]!])).toEqual([]);
    const withSite = parseSporttRaces([
      { id: 1, name: "Kraslické dny cyklistiky 2026", date: [2026, 9, 19], web: "https://x.cz/p.pdf" },
      { id: 2, name: "Kraslické dny cyklistiky 2026", date: [2026, 9, 20], web: "https://x.cz/" },
    ]);
    expect(withSite[0]!.websiteUrl).toBeUndefined();
    expect(withSite[1]!.websiteUrl).toBe("https://x.cz/");
  });

  it("knows the host", () => {
    expect(isSporttHost("sportt.cz")).toBe(true);
    expect(isSporttHost("www.sportt.cz")).toBe(true);
    expect(isSporttHost("sport.cz")).toBe(false);
  });
});
