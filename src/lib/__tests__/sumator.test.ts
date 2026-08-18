import { describe, expect, it } from "vitest";
import {
  extractSumatorOfficialLinks,
  extractSumatorSeries,
  extractSumatorTrails,
  officialSiteHome,
  parseSumatorRaceDetail,
} from "@/lib/watcher/extractors/sumator";

const HYNCICE_DETAIL = `
<html>
  <h1 class='rd-hero__title'>XC Hynčice</h1>
  <div class='rd-hero__meta'>
    <a class="rd-btn rd-btn--soft rd-btn--sm" href="/cup/jesenicky-snek-2026">Jesenický šnek</a>
  </div>
  <div class='rd-facts'>
    <div class='rd-facts__item'>
      <div class='rd-facts__key'>Datum</div>
      <div class='rd-facts__val'>22.8.2026<div class='rd-muted-2'>sobota</div></div>
    </div>
    <div class='rd-facts__item'>
      <div class='rd-facts__key'>Místo</div>
      <div class='rd-facts__val'><a href="/race/xc-hyncice-22-8-2026/map">Hynčice pod Sušinou</a></div>
    </div>
    <div class='rd-facts__item'>
      <div class='rd-facts__key'>Trasy</div>
      <div class='rd-facts__val'>20 km / 15 km / 10 km / 5 km / Jesenický šneček</div>
    </div>
  </div>
  <p>Závod je součástí seriálu Jesenický šnek</p>
  <h2 class='rd-section__title'>Trasy</h2>
  <div class='rd-card'>
    <div class='rd-trail__head'>
      <div class='rd-trail__name'>4 okruhy <span class="rd-type-tag rd-type-tag--xc">XC</span></div>
      <div class='rd-trail__stats'><span>Délka <strong>20,0 km</strong></span></div>
    </div>
    <div class='rd-trail__block'>
      <div class='rd-trail__block-title'>Kategorie</div>
      <div class='rd-trail__block-content'><ul>
        <li>A - muži, 19 - 29 let (1997 - 2007)</li>
        <li>KI - kadeti, 15 - 16 let (2010 - 2011)</li>
      </ul></div>
    </div>
  </div>
  <div class='rd-card'>
    <div class='rd-trail__head'>
      <div class='rd-trail__name'>Jesenický šneček</div>
    </div>
  </div>
  <div class='rd-card'>
    <h3 class='rd-card__title'>Odkazy</h3>
    <a class="rd-btn" href="https://jesenickysnek.cz/">Web</a>
    <a class="rd-btn" href="https://www.facebook.com/jesenickysnek">Facebook</a>
    <a class="rd-btn" href="https://www.instagram.com/jesenickysnek/">Instagram</a>
  </div>
</html>
`;

describe("Sumator race detail", () => {
  it("uses the Odkazy Web button, not Sumator, as the official site", () => {
    const links = extractSumatorOfficialLinks(HYNCICE_DETAIL);
    expect(links.websiteUrl).toBe("https://jesenickysnek.cz/");
    expect(links.extraUrls).toContain("https://jesenickysnek.cz/");
    expect(officialSiteHome(links.websiteUrl)).toBe("https://jesenickysnek.cz");
  });

  it("reads series from the cup chip and trails including šneček", () => {
    const series = extractSumatorSeries(HYNCICE_DETAIL);
    expect(series.seriesName).toBe("Jesenický šnek");
    expect(series.seriesSlug).toBe("jesenicky-snek");
    expect(series.cupUrl).toContain("/cup/jesenicky-snek-2026");

    const trails = extractSumatorTrails(HYNCICE_DETAIL);
    expect(trails.some((c) => c.name.includes("šneček"))).toBe(true);
    expect(trails.some((c) => c.distanceKm === 20)).toBe(true);
    expect(trails.some((c) => /kadeti/i.test(c.name) && c.ageMin === 15)).toBe(true);
  });

  it("parses a detail page into an event with official web and categories", () => {
    const ev = parseSumatorRaceDetail(
      "https://sumator.cz/race/xc-hyncice-22-8-2026",
      HYNCICE_DETAIL,
    );
    expect(ev).not.toBeNull();
    expect(ev?.startDate).toBe("2026-08-22");
    expect(ev?.placeText).toContain("Hynčice");
    expect(ev?.websiteUrl).toBe("https://jesenickysnek.cz/");
    expect(ev?.sourceUrl).toContain("sumator.cz/race/");
    expect(ev?.seriesName).toBe("Jesenický šnek");
    expect(ev?.childUrls).toEqual(
      expect.arrayContaining([
        "https://jesenickysnek.cz",
        "https://sumator.cz/cup/jesenicky-snek-2026",
      ]),
    );
    expect(ev?.categories?.some((c) => /šneček/i.test(c.name))).toBe(true);
  });
});
