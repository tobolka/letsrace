import { describe, expect, it } from "vitest";
import { detailFacts, parseBikeboardPage } from "@/lib/watcher/extractors/bikeboard";

const row = (opts: {
  id?: string;
  day?: string;
  mon?: string;
  year?: string;
  bis?: string;
  name?: string;
  place?: string;
  flag?: string;
  cats?: string[];
  subs?: string[];
}) => {
  const {
    id = "15882", day = "6", mon = "Sep", year = "2026", bis = "",
    name = "MTB XCO Hohenems Schwefel", place = "Hohenems", flag = "at",
    cats = ["MTB"], subs = ["Cross Country"],
  } = opts;
  const href = `https://bikeboard.at/termine/slug-termin${id}`;
  return `<tr>
    <td class="termine-col-date"><a href="${href}"><div class="tev-date">
      <span class="tev-date__dow">So</span><span class="tev-date__day">${day}</span>
      <span class="tev-date__mon">${mon}</span><span class="tev-date__year">${year}</span>
      ${bis ? `<span class="tev-date__bis">${bis}</span>` : ""}
    </div></a></td>
    <td class="termine-col-event"><a href="${href}"><span>${name}</span></a></td>
    <td class="termine-col-location"><img src="https://bikeboard.at/images/flags/4x3/${flag}.svg"><span>${place}</span></td>
    <td class="termine-col-category"><div class="tev-chips">
      ${cats.map((c) => `<span class="tev-chip tev-chip--cat">${c}</span>`).join("")}
      ${subs.map((s) => `<span class="tev-chip tev-chip--sub">${s}</span>`).join("")}
    </div></td>
  </tr>`;
};

const page = (...rows: string[]) => `<table>${rows.join("")}</table>`;
const url = "https://bikeboard.at/termine/2026";

describe("parseBikeboardPage", () => {
  it("reads a race off the calendar table", () => {
    const [ev] = parseBikeboardPage(url, page(row({})));
    expect(ev).toMatchObject({
      externalId: "bikeboard-15882",
      name: "MTB XCO Hohenems Schwefel",
      startDate: "2026-09-06",
      endDate: undefined,
      placeText: "Hohenems",
      countryHint: "AT",
      discipline: ["xco"],
      audience: "mixed",
      sourceUrl: "https://bikeboard.at/termine/slug-termin15882",
    });
  });

  it("reads the Austrian month abbreviation", () => {
    const [ev] = parseBikeboardPage(url, page(row({ mon: "Jän", day: "9", year: "2027" })));
    expect(ev!.startDate).toBe("2027-01-09");
  });

  it("takes the country from the flag", () => {
    const [de] = parseBikeboardPage(url, page(row({ flag: "de" })));
    expect(de!.countryHint).toBe("DE");
  });

  it("rolls the year forward on a range that crosses New Year", () => {
    const [ev] = parseBikeboardPage(
      url,
      page(row({ day: "28", mon: "Dez", year: "2026", bis: "bis 3. Jan" })),
    );
    expect(ev).toMatchObject({ startDate: "2026-12-28", endDate: "2027-01-03" });
  });

  it("keeps a same-year range", () => {
    const [ev] = parseBikeboardPage(url, page(row({ bis: "bis 8. Sep" })));
    expect(ev!.endDate).toBe("2026-09-08");
  });

  it("reads Marathon as MTB or road depending on the bike", () => {
    const [mtb] = parseBikeboardPage(url, page(row({ cats: ["MTB"], subs: ["Marathon"] })));
    const [road] = parseBikeboardPage(url, page(row({ cats: ["Rennrad"], subs: ["Marathon"] })));
    expect(mtb!.discipline).toEqual(["xcm"]);
    expect(road!.discipline).toEqual(["gran_fondo"]);
  });

  it("falls back to the bike type when no event kind is tagged", () => {
    const [ev] = parseBikeboardPage(url, page(row({ cats: ["Rennrad"], subs: [] })));
    expect(ev!.discipline).toEqual(["road"]);
  });

  it("drops entries that are not races", () => {
    expect(parseBikeboardPage(url, page(row({ subs: ["Fahrtechnik"] })))).toHaveLength(0);
    expect(parseBikeboardPage(url, page(row({ subs: ["Messe/Flohmarkt"] })))).toHaveLength(0);
    expect(parseBikeboardPage(url, page(row({ subs: ["Triathlon"] })))).toHaveLength(0);
  });

  it("keeps a festival that also runs a race", () => {
    const [ev] = parseBikeboardPage(
      url,
      page(row({ subs: ["Fahrtechnik", "Marathon"], cats: ["MTB"] })),
    );
    expect(ev!.discipline).toEqual(["xcm"]);
  });

  it("marks a youth round and a touring ride", () => {
    const [kids] = parseBikeboardPage(url, page(row({ subs: ["Nachwuchsbewerb", "Cross Country"] })));
    const [ride] = parseBikeboardPage(url, page(row({ subs: ["Tour"], cats: ["Rennrad"] })));
    expect(kids!.audience).toBe("kids");
    expect(ride!.eventType).toBe("ride");
  });

  it("ignores a row with no usable date", () => {
    expect(parseBikeboardPage(url, page(row({ mon: "Xyz" })))).toHaveLength(0);
  });
});

describe("detailFacts", () => {
  it("takes the organiser site and the postcode, dropping the tracking parameter", () => {
    expect(
      detailFacts(`
        <a class="tdv2-btn tdv2-btn--primary" href="https://www.neusiedlersee-radmarathon.com/?utm_source=bikeboard">Homepage besuchen</a>
        <div class="tdv2-fact"><span class="tdv2-fact-key">Veranstalter</span><span class="tdv2-fact-val">HILL Racingteam</span></div>
        <div class="tdv2-fact"><span class="tdv2-fact-key">Ort</span><span class="tdv2-fact-val">7072 Mörbisch</span></div>
      `),
    ).toEqual({ website: "https://www.neusiedlersee-radmarathon.com/", place: "7072 Mörbisch" });
  });

  it("returns nothing when the page links only back to bikeboard", () => {
    expect(detailFacts(`<a class="tdv2-btn tdv2-btn--primary" href="https://bikeboard.at/x">x</a>`)).toEqual({});
  });
});
