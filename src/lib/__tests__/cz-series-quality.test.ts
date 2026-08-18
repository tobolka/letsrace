import { describe, expect, it } from "vitest";
import {
  parseDetskyMtbCup,
  parseEnduroSerie,
  enduroRacePageLinks,
  parsePoharMtb,
  parsePrahaMtb,
  parseZal,
} from "@/lib/watcher/extractors/cz-calendars";
import {
  preferDeeperOfficialUrl,
  resolveEventOutboundUrls,
} from "@/lib/watcher/public-url";

describe("ČP MTB calendar", () => {
  const html = `
    <table class="race-table"><tbody>
      <tr>
        <td class="date">5.–6. 9. 2026</td>
        <td class="race"><strong>NMNM</strong><span>Vysočina aréna</span></td>
        <td><span class="tag">C1</span></td>
        <td class="links">
          <a href="https://www.poharmtb.cz/files/propozice-nmnm-2026.pdf">Propozice</a>
          <a href="https://www.poharmtb.cz/">Časový plán</a>
          <a href="https://www.poharmtb.cz/files/technical-guide-mtb-cup-2026-nmnm.pdf">Technical guide</a>
        </td>
      </tr>
      <tr>
        <td class="date">31. 5. 2026</td>
        <td class="race"><strong>Praha</strong><span>Motol</span></td>
        <td><span class="tag red">MČR XCC</span></td>
        <td class="links">
          <a href="https://www.poharmtb.cz/files/propozice-mcr-short-track-xcc-2026-v2.pdf">Propozice</a>
        </td>
      </tr>
    </tbody></table>
  `;

  it("keeps unique source + propozice PDF, not the calendar listing as the race site", () => {
    const events = parsePoharMtb("https://www.poharmtb.cz/cross-country", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2026-09-05 ČP MTB — NMNM — Vysočina aréna",
      "2026-05-31 MČR — Praha — Motol",
    ]);
    expect(events[0]?.regulationsUrl).toContain("propozice-nmnm-2026.pdf");
    expect(events[0]?.websiteUrl).not.toMatch(/\.pdf(\?|$)/i);
    expect(events[0]?.sourceUrl).not.toBe("https://www.poharmtb.cz/cross-country");
    expect(new Set(events.map((e) => e.sourceUrl)).size).toBe(2);
    expect(events[1]?.seriesSlug).toBe("mcr-mtb");
    expect(events[1]?.discipline).toEqual(["xcc"]);
  });
});

describe("ZAL calendar", () => {
  const html = `
    <div class="polozka">
      <span class="nadpis"><a href="/propozice/129">MODRAVA</a></span>
      <span class="datum">6.9.2026</span>
    </div>
    <div class="polozka">
      <span class="nadpis"><a href="/propozice/130">LOPATÁRNA</a></span>
      <span class="datum">19.9.2026</span>
    </div>
  `;

  it("points each round at its propozice page", () => {
    const events = parseZal("https://zapadoceskaamaterskaliga.cz/kalendare/zal-2026", html);
    expect(events[0]?.sourceUrl).toBe("https://zapadoceskaamaterskaliga.cz/propozice/129");
    expect(events[0]?.websiteUrl).toBe("https://zapadoceskaamaterskaliga.cz/propozice/129");
    expect(events[0]?.regulationsUrl).toContain("/propozice/129");
    expect(events[0]?.registrationUrl).toContain("/prihlasky/zal-2026");
    expect(events.map((e) => e.startDate)).toEqual(["2026-09-06", "2026-09-19"]);
  });
});

describe("Pražský MTB pohár propozice", () => {
  const html = `
    <div class="entry-content">
      <p><strong>1.kolo – 11. dubna 2026, Motol 1</strong></p>
      <p><a href="https://prahamtb.cz/wp-content/uploads/2026/04/Propozice-PMTBP-2026-1.kolo-Motol-1.pdf">PROPOZICE 1.kolo MOTOL</a></p>
      <p><strong>3.kolo – 16. května 2026, Letňany</strong></p>
      <p><a href="https://prahamtb.cz/wp-content/uploads/2026/05/PMTBP-2026_Propozice_3_kolo_Kbely.pdf">PROPOZICE 3_kolo Letňany</a></p>
      <p><strong>Registrace 3.kola probíhá na tomto linku <a href="https://sportt.cz/register/1532">ZDE</a></strong></p>
      <p><strong>4.kolo – 17. května 2026, Kbely</strong></p>
      <p><a href="https://prahamtb.cz/wp-content/uploads/2026/04/PMTBP-2026_Propozice_4_kolo_Kbely-2.pdf">PROPOZICE 4_Kolo_Kbely</a></p>
      <p><a href="https://sportt.cz/register/1533">ZDE</a></p>
    </div>
  `;

  it("attaches per-round propozice and Sportt registration", () => {
    const events = parsePrahaMtb("https://prahamtb.cz/?page_id=12", html);
    expect(events.map((e) => `${e.startDate} ${e.placeText}`)).toEqual([
      "2026-04-11 Praha — Motol 1",
      "2026-05-16 Praha — Letňany",
      "2026-05-17 Praha — Kbely",
    ]);
    expect(events[0]?.regulationsUrl).toContain("1.kolo-Motol");
    expect(events[1]?.registrationUrl).toBe("https://sportt.cz/register/1532");
    expect(events[2]?.registrationUrl).toBe("https://sportt.cz/register/1533");
    expect(new Set(events.map((e) => e.sourceUrl)).size).toBe(3);
  });
});

describe("Czech Enduro Series listing", () => {
  const html = `
    <ul>
      <li><a href="https://www.enduroserie.cz/zavody/enduro-race-moravka/">Enduro Race Morávka 30.8.</a></li>
      <li><a href="https://www.enduroserie.cz/zavody/enduro-race-moravka/">Enduro Race Morávka MČR 30.8.</a></li>
      <li><a href="https://www.enduroserie.cz/zavody/enduro-race-kralicak/">Enduro Race Kraličák 20.9.</a></li>
      <li><a href="https://www.enduroserie.cz/zavody/enduro-race-placeholder/">Enduro Race TBA 1.10.</a></li>
      <li><a href="https://www.enduroserie.cz/zavody/enduro-race-tba/">Enduro Race Czarna Gora 28.6.</a></li>
    </ul>
  `;

  it("uses the race page as sourceUrl, keeps Czarna behind a tba slug, skips TBA names", () => {
    const events = parseEnduroSerie("https://www.enduroserie.cz/zavody/", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2026-08-30 Enduro Race Morávka MČR",
      "2026-09-20 Enduro Race Kraličák",
      "2026-06-28 Enduro Race Czarna Gora",
    ]);
    expect(events[0]?.websiteUrl).toBe("https://www.enduroserie.cz/zavody/enduro-race-moravka/");
    expect(events[2]?.websiteUrl).toBe("https://www.enduroserie.cz/zavody/enduro-race-tba/");
    expect(events[2]?.countryHint).toBe("PL");
    expect(events.every((e) => e.sourceUrl !== "https://www.enduroserie.cz/zavody/")).toBe(true);
  });

  it("keeps Njuko enter links and ignores start lists / series hub", () => {
    const links = enduroRacePageLinks("https://www.enduroserie.cz/zavody/enduro-race-kouty/", `
      <a href="https://cdn.sportsoft.cz/data/pdf/872/5611/SL/20260523_startovka_es_kouty-zmeny.pdf">STARTOVNÍ ČASY A ČÍSLA</a>
      <a href="https://www.enduroserie.cz/registrace/">Registrace</a>
      <a href="https://in.njuko.com/enduro-race-moravka-mcr?id=abc&token=secret">REGISTRUJ SE</a>
    `);
    expect(links.registrationUrl).toBe("https://in.njuko.com/enduro-race-moravka-mcr?id=abc");
  });
});

describe("Dětský MTB Cup cards", () => {
  const html = `
    <div class="ProductView">
      <span class="created">13.09.2026</span>
      <h2><a href="/liberec-p8/">Liberec</a></h2>
    </div>
    <div class="ProductView">
      <span class="created">20.09.2026</span>
      <h2><a href="/nove-mesto-pod-smrkem-p34/">Nové Město pod Smrkem</a></h2>
    </div>
    <div class="ProductView">
      <span class="created">27.09.2026</span>
      <h2><a href="/slavnostni-vyhlaseni-p40/">Slavnostní vyhlášení</a></h2>
    </div>
  `;

  it("uses the product page, not the homepage, as sourceUrl", () => {
    const events = parseDetskyMtbCup("https://www.detskymtbcup.cz/", html);
    expect(events).toHaveLength(2);
    expect(events[0]?.websiteUrl).toBe("https://www.detskymtbcup.cz/liberec-p8/");
    expect(events[0]?.sourceUrl).toBe("https://www.detskymtbcup.cz/liberec-p8/");
    expect(events[1]?.sourceUrl).toContain("nove-mesto-pod-smrkem");
  });
});

describe("Prima Cup outbound URLs", () => {
  it("points at the race page, not /prihlaseni/ or the series homepage", () => {
    const out = resolveEventOutboundUrls({
      websiteUrl: "https://www.iprimacup.cz/26-hk/",
      registrationUrl: "https://www.iprimacup.cz/prihlaseni/",
      seriesWebsiteUrl: "https://www.iprimacup.cz/",
      sourceUrls: [
        "https://hynekmusil.cz",
        "https://www.iprimacup.cz/26-hk/",
      ],
    });
    expect(out.websiteUrl).toBe("https://www.iprimacup.cz/26-hk/");
    expect(out.registrationUrl).toBeNull();
  });

  it("upgrades a homepage website to /26-hk/ when the race page is in sources", () => {
    const out = resolveEventOutboundUrls({
      websiteUrl: "https://www.iprimacup.cz/",
      seriesWebsiteUrl: "https://www.iprimacup.cz/",
      sourceUrls: ["https://www.iprimacup.cz/26-hk/"],
    });
    expect(out.websiteUrl).toBe("https://www.iprimacup.cz/26-hk/");
  });

  it("prefers the race slug over /prihlaseni/ when merging", () => {
    expect(
      preferDeeperOfficialUrl(
        "https://www.iprimacup.cz/26-hk/",
        "https://www.iprimacup.cz/prihlaseni/",
      ),
    ).toBe("https://www.iprimacup.cz/26-hk/");
  });

  it("does not replace another organiser site with the Prima homepage", () => {
    const out = resolveEventOutboundUrls({
      websiteUrl: "https://www.skisumava.cz/mtb",
      seriesWebsiteUrl: "https://www.iprimacup.cz/",
    });
    expect(out.websiteUrl).toBe("https://www.skisumava.cz/mtb");
  });
});
