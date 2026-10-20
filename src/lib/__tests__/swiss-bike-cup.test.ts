import { describe, expect, it } from "vitest";
import { parseSwissBikeCupStage } from "@/lib/watcher/extractors/swiss-kids";

const series = "https://www.swissbikecup.ch/";

const stage = (opts: {
  heading?: string;
  label?: string;
  dates?: string;
  intro?: string;
  timetable?: string;
}) => {
  const {
    heading = "Gränichen, AG",
    label = "Hors Category (HC)",
    dates = `<div class="d-inline">September 12, 2026</div><div class="d-inline"> – </div><div class="d-inline">September 13, 2026</div>`,
    intro = "Die Swiss Bike Cup Saison beendet mit einem Klassiker die Saison 2026.",
    timetable = "10H30 Junioren | 14H30 Elite Herren / U23 Herren",
  } = opts;
  return `<html><head><title>Etappe ${heading}, Skoda Swiss Bike Cup</title></head><body>
    <h1>${heading}</h1>
    <div class="stage_intro-data">
      <div class="stage_category-wrap"><div>${label}</div></div>
      <div class="stage_date-wrap">${dates}</div>
    </div>
    <p class="text-size-large">${intro}</p>
    <div id="zeitplan">${timetable}</div>
    <p>Mehr News: Elite-Schweizermeistertitel vom July 19, 2026</p>
  </body></html>`;
};

const href = "https://www.swissbikecup.ch/etappe/graenichen";

describe("parseSwissBikeCupStage", () => {
  it("reads place, dates and series off a stage page", () => {
    expect(parseSwissBikeCupStage(series, href, stage({}))).toMatchObject({
      externalId: "swiss-bike-cup-2026-09-12-granichen",
      name: "Škoda Swiss Bike Cup — Gränichen",
      startDate: "2026-09-12",
      endDate: "2026-09-13",
      placeText: "Gränichen",
      countryHint: "CH",
      seriesSlug: "skoda-swiss-bike-cup",
      websiteUrl: href,
    });
  });

  it("takes the date from the stage header, not from a news item beside it", () => {
    const ev = parseSwissBikeCupStage(series, href, stage({}));
    expect(ev?.startDate).toBe("2026-09-12");
  });

  it("files a stage by what it says is raced, not by the series default", () => {
    const crit = parseSwissBikeCupStage(series, href, stage({ label: "Radkriterium" }));
    expect(crit?.discipline).toEqual(["criterium"]);

    const both = parseSwissBikeCupStage(series, href, stage({ label: "XCC  + XCO CH-Meisterschaften" }));
    expect(both?.discipline).toEqual(["xcc", "xco"]);
  });

  it("reads a UCI class alone as cross-country", () => {
    const hc = parseSwissBikeCupStage(series, href, stage({ label: "C1 & UCI Junior Series" }));
    expect(hc?.discipline).toEqual(["xco"]);
  });

  it("calls a round kids only when the round itself says so", () => {
    const kids = parseSwissBikeCupStage(
      series,
      href,
      stage({
        heading: "Moléson-sur-Gruyères, FR",
        label: "XCO",
        intro: "Im malerischen Moléson erwartet junge Bike-Fans das erste reine Škoda Swiss Bike Cup Kids Rennen.",
        timetable: "9H Kids Parcours U9 | 12H15 U13 | 16H45 Fun / Open",
      }),
    );
    expect(kids?.audience).toBe("kids");
  });

  it("does not turn a full round into a kids race for listing a kids parcours", () => {
    const ev = parseSwissBikeCupStage(
      series,
      href,
      stage({ timetable: "9H Kids Parcours U9 | 14H30 Elite Herren" }),
    );
    expect(ev?.audience).toBe("mixed");
  });

  it("stays mixed on a stage published before its timetable is up", () => {
    const ev = parseSwissBikeCupStage(
      series,
      href,
      stage({ intro: "Die Strecke wird noch bekannt gegeben.", timetable: "No items found." }),
    );
    expect(ev?.audience).toBe("mixed");
  });

  it("skips a stage page whose date is not published yet", () => {
    expect(
      parseSwissBikeCupStage(series, href, `<html><body><h1>Savognin, GR</h1></body></html>`),
    ).toBeNull();
  });
});
