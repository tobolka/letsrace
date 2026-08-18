import { describe, expect, it } from "vitest";
import { hasCscPublicGrid, parseCscCupListing, parseCscDate, parseCscPublicGrid } from "@/lib/watcher/extractors/csc";

const GRID = `
<table class="b-table b-datagrid">
  <tr class="table-row-selectable">
    <td data-caption="RaceDto.YearStart">2026</td>
    <td data-caption="Race"><a href="/RaceDetail/Race/797">HSF SYSTEM CUP - MČR OSTRAVA</a></td>
    <td data-caption="Start Date">1/10/2026</td>
    <td data-caption="End Date">1/10/2026</td>
    <td data-caption="RaceDto.RaceClassId">MČR</td>
    <td data-caption="Organizer">TACYKLISTIKA, z.s.</td>
    <td data-caption="Region">Moravskoslezský</td>
    <td data-caption="RaceDto">Ostrava</td>
    <td data-caption="Discipline">Cyklokros</td>
  </tr>
  <tr class="table-row-selectable">
    <td data-caption="Race"><a href="/RaceDetail/Race/1304">Krasojízda - Český pohár</a></td>
    <td data-caption="Start Date">2/28/2026</td>
    <td data-caption="End Date">2/28/2026</td>
    <td data-caption="RaceDto.RaceClassId">ČP</td>
    <td data-caption="RaceDto">Němčice</td>
    <td data-caption="Discipline">Sálová cyklistika</td>
  </tr>
  <tr class="table-row-selectable">
    <td data-caption="Race"><a href="/RaceDetail/Race/1711">Ostravský MTB Pohár</a></td>
    <td data-caption="Start Date">3/29/2026</td>
    <td data-caption="End Date">3/29/2026</td>
    <td data-caption="RaceDto.RaceClassId">KRAJ</td>
    <td data-caption="RaceDto">Ostrava</td>
    <td data-caption="Discipline">MTB</td>
  </tr>
  <tr class="table-row-selectable">
    <td data-caption="Race"><a href="/RaceDetail/Race/1346">ŠKODA CUP - Brno - Velká Bíteš - Brno</a></td>
    <td data-caption="Start Date">3/29/2026</td>
    <td data-caption="End Date">3/29/2026</td>
    <td data-caption="RaceDto.RaceClassId">ČP</td>
    <td data-caption="RaceDto">Velká Bíteš</td>
    <td data-caption="Discipline">Silnice</td>
  </tr>
</table>
`;

describe("ČSC portal grid", () => {
  it("parses US dates from the English Blazor UI", () => {
    expect(parseCscDate("1/10/2026")).toBe("2026-01-10");
    expect(parseCscDate("2/28/2026")).toBe("2026-02-28");
    expect(parseCscDate("28. 2. 2026")).toBe("2026-02-28");
    expect(parseCscDate("29 3. 2026")).toBe("2026-03-29");
  });

  it("keeps outdoor races and skips indoor cycling", () => {
    const events = parseCscPublicGrid(
      "https://portal.czechcyclingfederation.com/Races/Race/Pub",
      GRID,
    );
    expect(hasCscPublicGrid(GRID)).toBe(true);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2026-01-10 HSF SYSTEM CUP - MČR OSTRAVA",
      "2026-03-29 Ostravský MTB Pohár",
      "2026-03-29 ŠKODA CUP - Brno - Velká Bíteš - Brno",
    ]);
    expect(events[0]?.discipline).toEqual(["cx"]);
    expect(events[0]?.sourceUrl).toBe(
      "https://portal.czechcyclingfederation.com/RaceDetail/Race/797",
    );
    expect(events[0]?.externalId).toBe("csc-797");
    expect(events[1]?.discipline).toEqual(["mtb"]);
    expect(events[2]?.discipline).toEqual(["road"]);
    expect(events[2]?.seriesSlug).toBe("skoda-cup");
    expect(events.some((e) => /krasoj/i.test(e.name))).toBe(false);
  });

  it("reads MND CUP dates from the ČSC marketing table", () => {
    const html = `
      <table>
        <tr><td>Datum</td><td>Místo</td><td>Název</td></tr>
        <tr><td>11. 4. 2026</td><td>Bratronice</td><td>ČP Bratronice</td></tr>
        <tr><td>21. 6. 2026</td><td>Mladá Boleslav</td><td>ČP Mladá Boleslav – časovka jednotlivců</td></tr>
        <tr><td>13. 9. 2026</td><td>Prostějov</td><td>ČP Prostějov</td></tr>
      </table>
    `;
    const events = parseCscCupListing(
      "https://www.czechcyclingfederation.com/events/mnd-cup/",
      html,
      "mnd",
    );
    expect(events.map((e) => `${e.startDate} ${e.placeText}`)).toEqual([
      "2026-04-11 Bratronice",
      "2026-06-21 Mladá Boleslav",
      "2026-09-13 Prostějov",
    ]);
    expect(events[1]?.discipline).toEqual(["tt"]);
    expect(events.every((e) => e.seriesSlug === "mnd-cup")).toBe(true);
  });

  it("reads ČP BMX Racing with date / round / place columns", () => {
    const html = `
      <table>
        <tr><td>11. 4. 2026</td><td>1. Český pohár</td><td>Pardubice</td></tr>
        <tr><td>2. 5. 2026</td><td>3. Český pohár</td><td>Praha – Bohnice</td></tr>
        <tr><td>29. 8. 2026</td><td>MČR</td><td>Benátky nad Jizerou</td></tr>
      </table>
    `;
    const events = parseCscCupListing(
      "https://www.czechcyclingfederation.com/en/events/cesky-pohar-bmx/",
      html,
      "bmx",
    );
    expect(events.map((e) => `${e.startDate} ${e.placeText}`)).toEqual([
      "2026-04-11 Pardubice",
      "2026-05-02 Praha – Bohnice",
      "2026-08-29 Benátky nad Jizerou",
    ]);
    expect(events[2]?.name).toMatch(/MČR BMX/);
    expect(events.every((e) => e.discipline?.[0] === "bmx")).toBe(true);
    expect(events.every((e) => e.seriesSlug === "cesky-pohar-bmx")).toBe(true);
  });
});
