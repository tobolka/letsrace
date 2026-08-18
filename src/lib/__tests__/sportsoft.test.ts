import { describe, expect, it } from "vitest";
import { parseKalendarSportsoft } from "@/lib/watcher/extractors/sportsoft";
import { normalizeUrlForDedup } from "@/lib/dedup";

const row = (opts: {
  id: string;
  name: string;
  sport: string;
  date: string;
  place: string;
  extraLinks?: string;
}) => `
  <tr>
    <td></td>
    <td><a href="https://kalendar.sportsoft.cz/race/${opts.id}">${opts.name}</a></td>
    <td></td>
    <td><small>${opts.sport}</small></td>
    <td><small>${opts.date}</small></td>
    <td><small>${opts.place}</small></td>
    <td></td>
    <td>${opts.extraLinks ?? ""}</td>
    <td></td>
  </tr>
`;

describe("SportSoft kalendar", () => {
  it("keeps cycling rows, skips running, and uses the race page as source", () => {
    const html = `
      <table id="overview-table"><tbody>
        ${row({
          id: "987",
          name: "West Bohemia Tour 2026",
          sport: "ROAD cycling",
          date: "20.08 - 23.08.2026",
          place: "Plzeňský kraj",
        })}
        ${row({
          id: "827",
          name: "MND CUP - Vesec",
          sport: "ROAD cycling",
          date: "22.08.2026",
          place: "Vesec",
          extraLinks: `
            <a href="https://registrace.sportsoft.cz/startlist.aspx?e=3538">Startlist</a>
            <a href="https://csc.sportsoft.cz/startreg.aspx?m=466">Register now</a>
          `,
        })}
        ${row({
          id: "941",
          name: "Night run Liptovský Mikuláš 2026",
          sport: "Run",
          date: "22.08.2026",
          place: "Liptovský Mikuláš",
          extraLinks: `<a href="https://registrace.sportsoft.cz/registration.aspx?e=3602">Register now</a>`,
        })}
        ${row({
          id: "1009",
          name: "Kritérium Bělkovice",
          sport: "",
          date: "29.08.2026",
          place: "Bělkovice",
        })}
        ${row({
          id: "952",
          name: "SP XCO MTB - Poráč 5.kolo - UCI C2",
          sport: "MTB",
          date: "12.09 - 13.09.2026",
          place: "Poráč",
        })}
      </tbody></table>
    `;
    const events = parseKalendarSportsoft("https://kalendar.sportsoft.cz/", html);
    expect(events.map((e) => e.name)).toEqual([
      "West Bohemia Tour 2026",
      "MND CUP - Vesec",
      "Kritérium Bělkovice",
      "SP XCO MTB - Poráč 5.kolo - UCI C2",
    ]);
    expect(events[0]?.startDate).toBe("2026-08-20");
    expect(events[0]?.endDate).toBe("2026-08-23");
    expect(events[0]?.sourceUrl).toBe("https://kalendar.sportsoft.cz/race/987");
    expect(events[0]?.websiteUrl).toBeUndefined();
    expect(events[1]?.seriesSlug).toBe("mnd-cup");
    expect(events[1]?.registrationUrl).toContain("startreg.aspx");
    expect(events[1]?.registrationUrl).not.toMatch(/startlist/i);
    expect(events[3]?.countryHint).toBe("SK");
    expect(events[3]?.discipline).toEqual(expect.arrayContaining(["xco"]));
  });
});

describe("SportSoft registration URLs are per-event", () => {
  it("does not treat shared registration.aspx paths as the same race", () => {
    expect(
      normalizeUrlForDedup("https://registrace.sportsoft.cz/registration.aspx?e=3458"),
    ).not.toBe(
      normalizeUrlForDedup("https://registrace.sportsoft.cz/registration.aspx?e=3412"),
    );
    expect(normalizeUrlForDedup("https://csc.sportsoft.cz/startreg.aspx?m=466")).toBe("");
  });

  it("keeps Rad-Bundesliga event_id and blanks the termine hub", () => {
    expect(
      normalizeUrlForDedup(
        "http://www.rad-bundesliga.net/startliste.html?liga_id=4&event_id=326",
      ),
    ).toBe("rad-bundesliga.net?event_id=326");
    expect(
      normalizeUrlForDedup("https://www.rad-bundesliga.net/männer/termine.html"),
    ).toBe("");
  });
});
