import { describe, expect, it } from "vitest";
import { extractWithAdapter } from "@/lib/watcher/extractors/adapters";
import {
  isSportchallengeListingUrl,
  parseSportchallenge,
} from "@/lib/watcher/extractors/sportchallenge";

const item = (opts: {
  cls: string;
  date: string;
  href: string;
  name: string;
  place: string;
  registrEnd?: string;
  extra?: string;
}) => `
  <li class="${opts.cls}">
    <span class="datum">${opts.date}</span><br>
    <a href="${opts.href}">${opts.name}</a> <span class="admin"></span>
    ${opts.extra ?? ""}
    <br><span class="misto">${opts.place}</span>
    ${opts.registrEnd ? `<span class="registrEnd" title="konec online registrace">${opts.registrEnd}</span>` : ""}
  </li>
`;

describe("sportchallenge.cz listing extractor", () => {
  it("recognises listing URLs across root, /cz/, and /en/ and skips detail pages", () => {
    expect(isSportchallengeListingUrl("https://www.sportchallenge.cz")).toBe(true);
    expect(isSportchallengeListingUrl("https://www.sportchallenge.cz/")).toBe(true);
    expect(isSportchallengeListingUrl("https://www.sportchallenge.cz/cz/")).toBe(true);
    expect(isSportchallengeListingUrl("https://www.sportchallenge.cz/en/")).toBe(true);
    expect(isSportchallengeListingUrl("https://www.sportchallenge.cz/cz/jicinska50/2027")).toBe(
      false,
    );
    expect(
      isSportchallengeListingUrl("https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2026"),
    ).toBe(false);
  });

  it("extracts upcoming cycling races from #bude and excludes running, skiing, hiking, triathlon, series and #bylo", () => {
    const html = `
      <div id="serie">
        <ul class="seznamZavodu">
          ${item({
            cls: "mtb",
            date: "01.08.2026 - 31.12.2026",
            href: "https://www.sportchallenge.cz/cz/stredecnipohar/2026",
            name: "Joy.bike Cup 2026 - Středeční pohár horských kol",
            place: "Jestřebí hory",
          })}
        </ul>
      </div>
      <div id="bude">
        <ul>
          <li class="r"><span id="r_2027">2027</span>
            <ul class="seznamZavodu">
              ${item({
                cls: "ski",
                date: "16.01.2027",
                href: "https://www.sportchallenge.cz/cz/noctulenichpasu/2027",
                name: "Noc tuleních pásů",
                place: "Pec pod Sněžkou",
                registrEnd: " 02.01.2027 20:00:00",
              })}
              ${item({
                cls: "beh",
                date: "22.05.2027",
                href: "https://www.sportchallenge.cz/cz/cityrunjicin/2027",
                name: "DEK Jičínská10 (CityRun Jičín)",
                place: "Jičín",
              })}
              ${item({
                cls: "mtb",
                date: "22.05.2027",
                href: "https://www.sportchallenge.cz/cz/jicinska50/2027",
                name: "DEK Jičínská50",
                place: "Jičín",
              })}
              ${item({
                cls: "pochod",
                date: "18.06.2027 - 19.06.2027",
                href: "https://www.sportchallenge.cz/cz/k100/2027",
                name: "Krakonošova 100, dálkový pochod",
                place: "Vrchlabí, Krkonoše",
              })}
              ${item({
                cls: "mtb",
                date: "17.07.2027",
                href: "https://www.sportchallenge.cz/cz/okolo-vlasenice/2027",
                name: "Okolo Vlasenice",
                place: "Lhota-Vlasenice (Vysočina)",
              })}
              ${item({
                cls: "nw",
                date: "24.07.2027",
                href: "https://www.sportchallenge.cz/cz/nordicwalkingkutnahora/2027",
                name: "Nordic Walking Kutná Hora",
                place: "Kutná Hora",
              })}
              ${item({
                cls: "mtb",
                date: "31.07.2027",
                href: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2027",
                name: "FILIPA Podkrkonošský maraton 2027",
                place: "Lázně Bělohrad",
                registrEnd: " 28.12.2026 10:00:00",
              })}
              ${item({
                cls: "mtb prihlasky",
                date: "14.08.2027",
                href: "https://www.sportchallenge.cz/cz/brtevman/2027",
                name: "Brtevman - terénní triatlon",
                place: "Lázně Bělohrad",
                extra: "(jen přihlášky)",
              })}
              ${item({
                cls: "triatlon",
                date: "21.08.2027",
                href: "https://www.sportchallenge.cz/cz/triatlon/2027",
                name: "Dřevěnický triatlon",
                place: "Dřevěnice",
              })}
              ${item({
                cls: "mtb",
                date: "28.08.2027",
                href: "https://www.sportchallenge.cz/cz/lesak-cup/2027",
                name: "LESÁK CUP 2027",
                place: "Červený Kostelec",
              })}
              ${item({
                cls: "k70",
                date: "04.09.2027",
                href: "https://www.sportchallenge.cz/cz/krkonosska70mtb/2027",
                name: "Krkonošská 70 MTB",
                place: "Janské Lázně",
              })}
              ${item({
                cls: "road",
                date: "11.09.2027",
                href: "https://www.sportchallenge.cz/cz/kral-zviciny/2027",
                name: "Král Zvičiny 2027",
                place: "Dvůr Králové nad Labem",
              })}
              ${item({
                cls: "cx prihlasky",
                date: "09.10.2027",
                href: "https://www.sportchallenge.cz/cz/praguecx/2027",
                name: "Suchdolský CityCross 2027",
                place: "Praha, Suchdol",
                extra: "(jen přihlášky)",
              })}
              ${item({
                cls: "mtb  beh  xco",
                date: "16.10.2027",
                href: "https://www.sportchallenge.cz/cz/sportovni-den/2027",
                name: "Ivanovický sportovní den",
                place: "Brno",
              })}
            </ul>
          </li>
        </ul>
      </div>
      <div id="bylo">
        <ul>
          <li class="r"><span id="r_2026">2026</span>
            <ul class="seznamZavodu">
              ${item({
                cls: "mtb",
                date: "01.08.2026",
                href: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2026",
                name: "FILIPA Podkrkonošský maraton 2026",
                place: "Lázně Bělohrad",
              })}
            </ul>
          </li>
        </ul>
      </div>
    `;

    const events = parseSportchallenge("https://www.sportchallenge.cz", html);
    expect(events.map((e) => [e.startDate, e.name])).toEqual([
      ["2027-05-22", "DEK Jičínská50"],
      ["2027-07-17", "Okolo Vlasenice"],
      ["2027-07-31", "FILIPA Podkrkonošský maraton 2027"],
      ["2027-08-28", "LESÁK CUP 2027"],
      ["2027-09-04", "Krkonošská 70 MTB"],
      ["2027-09-11", "Král Zvičiny 2027"],
      ["2027-10-09", "Suchdolský CityCross 2027"],
    ]);

    const podkrkonos = events.find((e) => e.name.includes("Podkrkonošský"));
    expect(podkrkonos).toMatchObject({
      externalId: "sportchallenge:podkrkonosskymaraton/2027",
      placeText: "Lázně Bělohrad",
      countryHint: "CZ",
      sourceUrl: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2027",
      registrationUrl: "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2027",
      registrationClosesAt: "2026-12-28",
    });
    expect(podkrkonos?.discipline).toContain("xcm");

    const k70 = events.find((e) => e.name === "Krkonošská 70 MTB");
    expect(k70?.discipline).toContain("xcm");

    const road = events.find((e) => e.name === "Král Zvičiny 2027");
    expect(road?.discipline).toContain("road");

    const cx = events.find((e) => e.name === "Suchdolský CityCross 2027");
    expect(cx?.discipline).toContain("cx");
  });

  it("handles cancelled events, multi-day stage races, and rejects invalid dates and season spans", () => {
    const html = `
      <div id="bude">
        <ul class="seznamZavodu">
          ${item({
            cls: "mtb enduro",
            date: "02.07.2027 - 05.07.2027",
            href: "https://www.sportchallenge.cz/cz/mtbtrilogy/2027",
            name: "Kupkolo MTB Trilogy 2027",
            place: "Teplice nad Metují",
          })}
          ${item({
            cls: "road zruseno",
            date: "07.06.2027",
            href: "https://www.sportchallenge.cz/cz/elm-mcely/2027",
            name: "Silniční závod Mcely (zrušeno)",
            place: "Mcely",
          })}
          ${item({
            cls: "mtb",
            date: "01.05.2027 - 31.07.2027",
            href: "https://www.sportchallenge.cz/cz/horokolo/2027",
            name: "Horokolo vršky",
            place: "Podkrkonoší",
          })}
          ${item({
            cls: "mtb",
            date: "00.00.0000",
            href: "https://www.sportchallenge.cz/cz/_204531",
            name: "Invalid",
            place: "",
          })}
        </ul>
      </div>
    `;
    const events = parseSportchallenge("https://www.sportchallenge.cz/cz/", html);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: "Kupkolo MTB Trilogy 2027",
      startDate: "2027-07-02",
      endDate: "2027-07-05",
    });
    expect(events[0]?.discipline).toEqual(expect.arrayContaining(["enduro"]));
    expect(events[1]).toMatchObject({
      name: "Silniční závod Mcely (zrušeno)",
      status: "cancelled",
    });
  });

  it("routes sportchallenge.cz through extractWithAdapter while keeping podkrkonosskymaraton/2026 intact", async () => {
    const listingHtml = `<div id="bude"><ul class="seznamZavodu">${item({
      cls: "mtb",
      date: "22.05.2027",
      href: "https://www.sportchallenge.cz/cz/jicinska50/2027",
      name: "DEK Jičínská50",
      place: "Jičín",
    })}</ul></div>`;
    const res = await extractWithAdapter(
      "www.sportchallenge.cz",
      "https://www.sportchallenge.cz",
      listingHtml,
    );
    expect(res).not.toBeNull();
    expect(res?.strategy).toBe("adapter:sportchallenge");
    expect(res?.events).toHaveLength(1);
    expect(res?.events[0]?.name).toBe("DEK Jičínská50");

    const podHtml = `<h2>01.08.2026 Lázně Bělohrad</h2>`;
    const podRes = await extractWithAdapter(
      "www.sportchallenge.cz",
      "https://www.sportchallenge.cz/cz/podkrkonosskymaraton/2026",
      podHtml,
    );
    expect(podRes?.strategy).toBe("adapter:podkrkonos");
    expect(podRes?.events).toHaveLength(1);

    const otherRes = await extractWithAdapter(
      "www.sportchallenge.cz",
      "https://www.sportchallenge.cz/cz/jicinska50/2027",
      "<html></html>",
    );
    expect(otherRes).toEqual({ events: [], strategy: "adapter:sportchallenge-skip" });
  });
});
