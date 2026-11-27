import { describe, expect, it } from "vitest";
import { parsePoharMtb } from "@/lib/watcher/extractors/cz-calendars";

describe("ČP MTB XCM maraton calendar (poharmtb.cz/maraton)", () => {
  const html2027 = `
    <div class="block block-inline">
      <h3 class="start"><strong>Český pohár XCM 2027: Pět atraktivních lokalit a mistrovství ČR na Malevilu</strong></h3>
      <h4 class="start"><strong>Kalendář Českého poháru XCM 2027:</strong></h4>
      <table class="table table-bordered">
        <tbody>
          <tr><th><p>Datum</p></th><th><p>Závod</p></th><th><p>Místo</p></th></tr>
          <tr><td><p>22. 5. 2027</p></td><td><p>Silesia Bike Marathon</p></td><td><p>Opava</p></td></tr>
          <tr><td><p>12. 6. 2027</p></td><td><p>Malevil CUP – <strong>MČR XCM</strong></p></td><td><p>Jablonné v Podještědí</p></td></tr>
          <tr><td><p>26. 6. 2027</p></td><td><p>Obr Drásal</p></td><td><p>Holešov</p></td></tr>
          <tr><td><p>24. 7. 2027</p></td><td><p>Šumavský MTB Maraton</p></td><td><p>Zadov</p></td></tr>
          <tr><td><p>11. 9. 2027</p></td><td><p>Rallye Sudety</p></td><td><p>Teplice nad Metují</p></td></tr>
        </tbody>
      </table>
      <h4 class="start"><strong>Pět závodů s vlastní tradicí a charakterem</strong></h4>
      <h3 class="start"><a target="_blank" rel="noopener noreferrer nofollow" href="https://www.silesiaopava.cz/">Silesia Bike Marathon</a> - Opava (22. 5. 2027)</h3>
      <h3 class="start"><a target="_blank" rel="noopener noreferrer nofollow" href="https://www.malevilcup.cz/">Malevil CUP</a> - Jablonné v Podještědí (12. 6. 2027)</h3>
      <h3 class="start"><a target="_blank" rel="noopener noreferrer nofollow" href="https://www.drasal.cz/">Obr Drásal</a> - Holešov (26. 6. 2027)</h3>
      <h3 class="start"><a target="_blank" rel="noopener noreferrer nofollow" href="https://www.skisumava.cz/">Šumavský MTB Maraton</a> - Zadov (24. 7. 2027)</h3>
      <h3 class="start"><a target="_blank" rel="noopener noreferrer nofollow" href="https://redpointteam.cz/">Rallye Sudety</a> - Teplice nad Metují (11. 9. 2027)</h3>
    </div>
    <div class="block block-button">
      <div class="center"><a class="btn btn-default" href="https://cpxcm.sportsoft.cz/2026/results.aspx"><span class="btn__label">Průběžné pořadí českého poháru v maratonu</span></a></div>
    </div>
    <div class="block block-button">
      <div class="center"><a class="btn btn-default" href="https://www.poharmtb.cz/files/12425-pravidla-cp-xcm-2026.pdf" target="_blank"><span class="btn__label">Podmínky a pravidla pro Český pohár v maratonu 2026</span></a></div>
    </div>
    <div class="block block-button">
      <div class="left"><a class="btn btn-default btn-fullwidth" href="https://www.silesiaopava.cz/bikenew/"><span class="btn__label">Silesia Bike Marathon</span></a></div>
      <div class="center"><a class="btn btn-default btn-fullwidth" href="https://www.skisumava.cz/mtb"><span class="btn__label">Šumavský MTB maraton</span></a></div>
      <div class="center"><a class="btn btn-default btn-fullwidth" href="https://malevilcup.cz/"><span class="btn__label">Malevil Cup</span></a></div>
      <div class="center"><a class="btn btn-default btn-fullwidth" href="https://redpointteam.cz/rallye-sudety/"><span class="btn__label">Rallye Sudety</span></a></div>
    </div>
  `;

  it("parses all 5 2027 XCM rounds with dates, venues, MČR tag, and official race websites", () => {
    const events = parsePoharMtb("https://www.poharmtb.cz/maraton", html2027);
    expect(events).toHaveLength(5);
    expect(events.map((e) => `${e.startDate} | ${e.name} | ${e.placeText}`)).toEqual([
      "2027-05-22 | ČP MTB XCM — Silesia Bike Marathon | Opava",
      "2027-06-12 | MČR XCM — Malevil CUP | Jablonné v Podještědí",
      "2027-06-26 | ČP MTB XCM — Obr Drásal | Holešov",
      "2027-07-24 | ČP MTB XCM — Šumavský MTB Maraton | Zadov",
      "2027-09-11 | ČP MTB XCM — Rallye Sudety | Teplice nad Metují",
    ]);
    expect(events.map((e) => e.websiteUrl)).toEqual([
      "https://www.silesiaopava.cz/bikenew/",
      "https://malevilcup.cz/",
      "https://www.drasal.cz/",
      "https://www.skisumava.cz/mtb",
      "https://redpointteam.cz/rallye-sudety/",
    ]);
    for (const ev of events) {
      expect(ev.discipline).toEqual(["xcm"]);
      expect(ev.countryHint).toBe("CZ");
      expect(ev.seriesSlug).toBe("cesky-pohar-mtb-xcm");
      expect(ev.seriesName).toBe("Český pohár MTB XCM");
      expect(ev.sourceUrl).toBe(ev.websiteUrl);
      expect(ev.regulationsUrl).toBeUndefined();
    }
  });

  it("still parses legacy <ul> XCM calendar markup when no table or heading dates exist", () => {
    const legacyHtml = `
      <div class="block block-inline">
        <h3>Český pohár XCM 2026</h3>
        <ul>
          <li>23. května – <a href="https://www.silesiaopava.cz/">Silesia Bike Marathon</a>, Opava</li>
          <li>13. června – <a href="https://www.malevilcup.cz/">Malevil CUP MČR</a>, Jablonné v Podještědí</li>
        </ul>
      </div>
    `;
    const events = parsePoharMtb("https://www.poharmtb.cz/maraton", legacyHtml);
    expect(events.map((e) => `${e.startDate} | ${e.name} | ${e.placeText}`)).toEqual([
      "2026-05-23 | ČP MTB XCM — Silesia Bike Marathon | Opava",
      "2026-06-13 | MČR XCM — Malevil CUP MČR | Jablonné v Podještědí",
    ]);
    expect(events[0]?.websiteUrl).toBe("https://www.silesiaopava.cz/");
    expect(events[1]?.websiteUrl).toBe("https://www.malevilcup.cz/");
  });
});
