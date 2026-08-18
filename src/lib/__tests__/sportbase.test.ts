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
});
