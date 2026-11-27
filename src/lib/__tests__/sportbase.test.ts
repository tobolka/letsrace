import { describe, expect, it } from "vitest";
import { parseSportBase } from "@/lib/watcher/extractors/sportbase";
import { normalizeUrlForDedup } from "@/lib/dedup";

const row = (opts: { title: string; date: string; place: string; slug: string; extra?: string }) => `
  <tr>
    <td></td>
    <td>${opts.date}</td>
    <td>
      <a title="${opts.title}" href="/competitions/${opts.slug}">${opts.title}</a>
      ${opts.extra ?? ""}
    </td>
    <td>${opts.place}</td>
    <td></td>
  </tr>
`;

describe("sport:base competitions", () => {
  it("keeps cycling rows, skips running and OVER ALL standings", () => {
    const html = `
      <table>
        ${row({ title: "NOVOROČNÍ BĚH - 25. ročník", date: "1. 1. 2026", place: "Konopiště", slug: "novorocnibeh-26" })}
        ${row({ title: "DECATHLON CYKLOMARATON 2026", date: "31. 5. 2026", place: "Hradec Králové", slug: "cmt-26" })}
        ${row({
          title: "DECATHLON CYKLOMARATON - dětský závod",
          date: "31. 5. 2026",
          place: "Hradec Králové",
          slug: "cmt-kids-26",
        })}
        ${row({
          title: "Kupkolo.cz MTB Trilogy - Prolog - MTB",
          date: "4. 7. 2026",
          place: "Teplice nad Metují",
          slug: "trilogy1-mtb-26",
        })}
        ${row({
          title: "Kupkolo.cz MTB Trilogy - Prolog - ENDURO",
          date: "4. 7. 2026",
          place: "Teploice nad Metují",
          slug: "trilogy1-enduro-26",
        })}
        ${row({
          title: "Kupkolo.cz MTB Trilogy - MARATHON - OVER ALL",
          date: "6. 7. 2026",
          place: "Teplice nad Metují",
          slug: "trilogy-mtb-26",
        })}
        ${row({
          title: "KUJEBIKE 2026",
          date: "29. 8. 2026",
          place: "Vysoké Mýto - Vinice",
          slug: "kujebike-26",
          extra: `<a href="/competitions/kujebike-26/register">Registrovat</a>`,
        })}
      </table>
    `;
    const events = parseSportBase("https://sport-base.eu/competitions", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2026-05-31 DECATHLON CYKLOMARATON 2026",
      "2026-05-31 DECATHLON CYKLOMARATON - dětský závod",
      "2026-07-04 Kupkolo.cz MTB Trilogy - Prolog - MTB",
      "2026-07-04 Kupkolo.cz MTB Trilogy - Prolog - ENDURO",
      "2026-08-29 KUJEBIKE 2026",
    ]);
    expect(events.find((e) => /dětský/.test(e.name))?.audience).toBe("kids");
    expect(events.find((e) => /ENDURO/.test(e.name))?.discipline).toContain("enduro");
    expect(events.find((e) => /ENDURO/.test(e.name))?.placeText).toBe("Teplice nad Metují");
    expect(events.find((e) => /KUJEBIKE/.test(e.name))?.registrationUrl).toContain(
      "/competitions/kujebike-26/register",
    );
    expect(normalizeUrlForDedup("https://sport-base.eu/competitions")).toBe("");
    expect(normalizeUrlForDedup("https://sport-base.eu/competitions/kujebike-26")).toContain(
      "kujebike-26",
    );
  });

  it("parses Next.js App Router RSC payload, maps series/endDate/links, and excludes OCR/running/canicross", () => {
    const races = [
      {
        id: "1",
        slug: "pc-hradec-27",
        name: "BAIC PRIMA CUP 2027 – Hradec Králové",
        day: "2027-04-10",
        location: "Hradec Králové",
        sport: "MTB",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "2",
        slug: "nr-ostrava-27",
        name: "NN NIGHT RUN OSTRAVA",
        day: "2027-04-10",
        location: "Ostrava",
        sport: "Běh",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "3",
        slug: "canicross-27",
        name: "CANICROSS CUP 2027",
        day: "2027-04-17",
        location: "Velké Opatovice",
        sport: "Canicross / OCRC",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "4",
        slug: "400-ultra-200-hard",
        name: "400 ultra / 200 hard",
        day: "2027-05-21",
        location: "Mostek",
        sport: "MTB",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "5",
        slug: "cmt-27",
        name: "DECATHLON CYKLOMARATON 2027",
        day: "2027-05-30",
        location: "Hradec Králové",
        sport: "MTB",
        hasPublicResults: false,
        canRegister: false,
      },
      {
        id: "6",
        slug: "sr-sobota-27",
        name: "ŠNEK RACE 2027 - SOBOTA",
        day: "2027-06-26",
        location: "Chřibská",
        sport: "OCR",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "7",
        slug: "trilogy-mtb-27",
        name: "Kupkolo.cz MTB Trilogy 2027 - MTB - 3. - 5.7.2027",
        day: "2027-07-03",
        location: "Teplice nad Metují",
        sport: "MTB",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "8",
        slug: "juniorcup-27",
        name: "JUNIOR cup - 9. ročník",
        day: "2027-08-22",
        location: "Hradec Králové",
        sport: "MTB",
        hasPublicResults: true,
        canRegister: true,
      },
      {
        id: "9",
        slug: "pc-valtice-27",
        name: "BAIC PRIMA CUP 2027 – Valtice",
        day: "2027-09-18",
        location: "Valtice",
        sport: "MTB",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "10",
        slug: "pc-gocar-27",
        name: "Gočárovy schody",
        day: "2027-09-28",
        location: "Hradec Králové",
        sport: "MTB",
        hasPublicResults: false,
        canRegister: true,
      },
      {
        id: "11",
        slug: "trilogy-overall-27",
        name: "Kupkolo.cz MTB Trilogy 2027 - OVER ALL",
        day: "2027-07-05",
        location: "Teplice nad Metují",
        sport: "MTB",
        hasPublicResults: true,
        canRegister: false,
      },
    ];
    const rscChunk = `1a:["$","div",null,{"children":["$","$L2a",null,{"races":${JSON.stringify(races)}}]}]`;
    const html = `<!doctype html><html><body><script>self.__next_f.push([1,${JSON.stringify(rscChunk)}])</script></body></html>`;

    const events = parseSportBase("https://sport-base.eu/competitions", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2027-04-10 BAIC PRIMA CUP 2027 – Hradec Králové",
      "2027-05-21 400 ultra / 200 hard",
      "2027-05-30 DECATHLON CYKLOMARATON 2027",
      "2027-07-03 Kupkolo.cz MTB Trilogy 2027 - MTB - 3. - 5.7.2027",
      "2027-08-22 JUNIOR cup - 9. ročník",
      "2027-09-18 BAIC PRIMA CUP 2027 – Valtice",
      "2027-09-28 Gočárovy schody",
    ]);

    const hradec = events.find((e) => e.externalId === "sportbase-pc-hradec-27");
    expect(hradec?.registrationUrl).toBe("https://sport-base.eu/competitions/pc-hradec-27/register");
    expect(hradec?.resultsUrl).toBeUndefined();
    expect(hradec?.seriesName).toBe("Prima CUP");
    expect(hradec?.seriesSlug).toBe("prima-cup");
    expect(hradec?.websiteUrl).toBe("https://www.iprimacup.cz");

    const gocar = events.find((e) => e.externalId === "sportbase-pc-gocar-27");
    expect(gocar?.seriesSlug).toBe("prima-cup");
    expect(gocar?.websiteUrl).toBe("https://www.iprimacup.cz");

    const trilogy = events.find((e) => e.externalId === "sportbase-trilogy-mtb-27");
    expect(trilogy?.endDate).toBe("2027-07-05");
    expect(trilogy?.websiteUrl).toBe("https://www.mtbtrilogy.com");
    expect(trilogy?.registrationUrl).toBe(
      "https://sport-base.eu/competitions/trilogy-mtb-27/register",
    );

    const junior = events.find((e) => e.externalId === "sportbase-juniorcup-27");
    expect(junior?.seriesName).toBe("JUNIOR cup");
    expect(junior?.seriesSlug).toBe("junior-cup");
    expect(junior?.websiteUrl).toBe("https://www.juniorcup.net");
    expect(junior?.resultsUrl).toBe("https://sport-base.eu/competitions/juniorcup-27/results");

    const cmt = events.find((e) => e.externalId === "sportbase-cmt-27");
    expect(cmt?.registrationUrl).toBeUndefined();
    expect(cmt?.seriesSlug).toBe("decathlon-cyklomaraton");
  });

  it("falls back to rendered Next.js competition cards when RSC payload is absent", () => {
    const html = `
      <div class="list">
        <div class="card">
          <div class="min-w-0">
            <a href="/competitions/pc-hradec-27">BAIC PRIMA CUP 2027 – Hradec Králové</a>
            <p>So 10. 4. 2027, Hradec Králové, MTB</p>
          </div>
          <div class="actions">
            <div><a href="/competitions/pc-hradec-27/register">Registrovat</a></div>
          </div>
        </div>
        <div class="card">
          <div class="min-w-0">
            <a href="/competitions/sr-sobota-27">ŠNEK RACE 2027 - SOBOTA</a>
            <p>So 26. 6. 2027, Chřibská, OCR</p>
          </div>
          <div class="actions">
            <div><a href="/competitions/sr-sobota-27/register">Registrovat</a></div>
          </div>
        </div>
        <div class="card">
          <div class="min-w-0">
            <a href="/competitions/cmt-27">DECATHLON CYKLOMARATON 2027</a>
            <p>Ne 30. 5. 2027, Hradec Králové, MTB</p>
          </div>
          <div class="actions"></div>
        </div>
      </div>
    `;
    const events = parseSportBase("https://sport-base.eu/competitions", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2027-04-10 BAIC PRIMA CUP 2027 – Hradec Králové",
      "2027-05-30 DECATHLON CYKLOMARATON 2027",
    ]);
    expect(events[0]?.registrationUrl).toBe(
      "https://sport-base.eu/competitions/pc-hradec-27/register",
    );
    expect(events[0]?.placeText).toBe("Hradec Králové");
    expect(events[1]?.registrationUrl).toBeUndefined();
  });
});
