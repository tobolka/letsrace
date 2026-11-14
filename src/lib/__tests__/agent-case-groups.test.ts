import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { calendarKey, groupCalendars, groupSameRace, mergeFoundRaces, pairKey } from "@/lib/pipeline2/agent-case-groups";
import { isSeparateRace } from "@/lib/catalog/merge-duplicates";

const require = createRequire(import.meta.url);
const { checkAnswer } = require("../../../scripts/agent-answer.cjs") as { checkAnswer: (kind: string, body: object, reply: string) => { ok: boolean; answer?: Record<string, unknown> } };

// The cases the agent was given twice on 2026-11-14.
const malevil = (id: string, name: string, site: string) => ({ case: `nextdate-${id.slice(0, 8)}`, kind: "find_next_date", wanted_year: 2027,
  race: { id, name, last_date: "2026-06-13", website: site, pages_we_read: [site, `${site}index.php/mcr-xcm`] } });

describe("identical agent cases are asked once", () => {
  it("folds Malevil's two records (hyphen and en dash) into one date search", () => {
    const grouped = groupSameRace([malevil("5d532221-f028", "ČP MTB XCM - Malevil cup", "https://www.malevilcup.cz/"), malevil("ed231780-dcd8", "ČP MTB XCM — Malevil Cup", "https://malevilcup.cz/")]);
    expect(grouped).toHaveLength(1);
    expect((grouped[0]!.race as { same_race_ids?: string[] }).same_race_ids).toEqual(["ed231780-dcd8"]);
    expect(grouped[0]!.race.pages_we_read).toContain("https://malevilcup.cz/");
  });

  it("files one answer for every record of the race", () => {
    const body = { race: { id: "5d532221-f028", same_race_ids: ["ed231780-dcd8"] }, wanted_year: 2027 };
    const checked = checkAnswer("find_next_date", body, JSON.stringify({ verdict: "announced", start_date: "2027-06-12", end_date: null, url: "https://www.malevilcup.cz/index.php/propozice", quote: "Termín konání: 12. 6. 2027", note: "In the regulations." }));
    expect(checked.ok).toBe(true);
    expect(checked.answer).toMatchObject({ race: "5d532221-f028", same_race_ids: ["ed231780-dcd8"] });
  });

  it("gives the Stubalpen pair one key whichever way round it is asked", () => {
    expect(pairKey("89c33129-3764", "08593b87-2f01")).toBe(pairKey("08593b87-2f01", "89c33129-3764"));
  });

  it("keeps the Saturday endurance race and the Sunday kids race two events", () => {
    const stub = (id: string, name: string, date: string) => ({ case: `regulations-${id}`, race: { id, name, date } });
    expect(groupSameRace([stub("08593b87", "Stubalpen Mehrstunden Trophy", "2027-04-17"), stub("89c33129", "Stubalpen Kids Trophy", "2027-04-18")])).toHaveLength(2);
    const found = (name: string, start_date: string) => ({ name, start_date, end_date: null, place: "Maria Lankowitz", country: "AT", discipline: "mtb", url: "https://cyclingaustria.at/kalender?bl=Steiermark&view=events", quote: name });
    expect(mergeFoundRaces([found("Stubalpen Mehrstunden Trophy", "2027-04-17"), found("Stubalpen Kids Trophy", "2027-04-18")])).toHaveLength(2);
    expect(isSeparateRace("Stubalpen Mehrstunden Trophy", "Stubalpen Kids Trophy")).toBe(true);
  });

  it("reads Cycling Austria's general and road filters as one calendar", () => {
    const view = (url: string, have: { name: string; date: string }[]) => ({ case: `calendar-${url.length}`, source: { url, kind: "federation" }, we_have: have });
    expect(calendarKey("https://www.cyclingaustria.at/kalender?view=events&page=3")).toBe(calendarKey("https://cyclingaustria.at/kalender?sparten=strasse&view=events"));
    const grouped = groupCalendars([
      view("https://www.cyclingaustria.at/kalender?sparten=strasse&view=events", [{ name: "Kriterium Graz", date: "2027-05-01" }]),
      view("https://www.cyclingaustria.at/kalender?view=events&page=3", [{ name: "Kriterium Graz", date: "2027-05-01" }, { name: "Glocknerkönig", date: "2027-06-06" }]),
      view("https://www.radsport-events.de/kalender", []),
    ]);
    expect(grouped).toHaveLength(2);
    expect((grouped[0]!.source as { also?: string[] }).also).toEqual(["https://www.cyclingaustria.at/kalender?view=events&page=3"]);
    expect(grouped[0]!.we_have.map(race => race.name)).toEqual(["Kriterium Graz", "Glocknerkönig"]);
  });

  it("merges Waidhofner Radmarathon and Kriterium Grafenstein found on both filters, keeping every link", () => {
    const road = "https://cyclingaustria.at/kalender?sparten=stra%C3%9Fe&view=events", all = "https://www.cyclingaustria.at/kalender?page=3&view=events";
    const answer = (url: string, from: string) => [
      { name: "41. Waidhofner Radmarathon 2027", start_date: "2027-05-23", end_date: null, place: null, country: "AT", discipline: "road", url, quote: `So, 23. Mai 2027 | 08.00–14.00 Uhr  41. Waidhofner Radmarathon 2027 (${from})`, from },
      { name: "Kriterium Grafenstein", start_date: "2027-05-27", end_date: null, place: "Grafenstein", country: "AT", discipline: "criterium", url, quote: `Do, 27. Mai 2027 | 12.00–15.00 Uhr  Kriterium Grafenstein (${from})`, from },
    ];
    const merged = mergeFoundRaces([...answer(road, "calendar-4fb1334b"), ...answer(all, "calendar-e33ed6a2")]);
    expect(merged).toHaveLength(2);
    for (const race of merged) {
      expect(race.urls.sort()).toEqual([road, all].sort());
      expect(race.from_cases.sort()).toEqual(["calendar-4fb1334b", "calendar-e33ed6a2"]);
      // Filed under one page, with the quote found on that page.
      expect(race.quote).toContain(race.url === road ? "calendar-4fb1334b" : "calendar-e33ed6a2");
    }
    // Filed the same way whichever answer came first.
    expect(mergeFoundRaces([...answer(all, "calendar-e33ed6a2"), ...answer(road, "calendar-4fb1334b")]).map(race => race.url)).toEqual(merged.map(race => race.url));
  });
});
