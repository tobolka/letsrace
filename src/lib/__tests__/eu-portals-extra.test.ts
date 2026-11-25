import { describe, expect, it } from "vitest";
import {
  extractComputerauswertungLinks,
  isEnduCyclingSlug,
  parseComputerauswertung,
  parseCzasNaRower,
  parseDeMonthDate,
  parseEnduEvent,
  parseVysledkovyServis,
} from "@/lib/catalog/eu-portals-extra";

describe("extra EU cycling portals", () => {
  it("parses czasnarower.pl/wyscigi rows with ISO dates in data-tags", () => {
    const html = `<div class="cnr-race-sub-row" data-id="6095" data-tags="vii_lesna_zadyma,2027-02-14,rok_2027,maratony_mtb">
      <div class="cnr-race-row-info">
        <h3 class="cnr-race-row-title"><a href="https://www.czasnarower.pl/wyscig/6095">VII Leśna Zadyma MTB</a></h3>
        <span class="cnr-race-row-geo">Czarna koło Łańcuta</span>
      </div>
    </div>`;
    const rows = parseCzasNaRower(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "6095", date: "2027-02-14", place: "Czarna koło Łańcuta", discipline: "xcm" });
  });

  it("parses computerauswertung.at German dates and filters to cycling", () => {
    expect(parseDeMonthDate("9. - 10 Jänner 2027")).toEqual({ startDate: "2027-01-09", endDate: "2027-01-10" });
    const html = `<table class="kl">
      <tr><td>22. Mai 2027</td><td>|</td><td><a href="/veranstaltung.php?V_ID=270522&lang=de">Pama Energie Gravel</a></td></tr>
      <tr><td>7. März 2027</td><td>|</td><td><a href="/veranstaltung.php?V_ID=270307&lang=de">16. Delta Stundenlauf</a></td></tr>
    </table>`;
    const rows = parseComputerauswertung(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "270522", startDate: "2027-05-22", discipline: "gravel" });
    const links = extractComputerauswertungLinks(`<a href="https://pamagravel.at">Homepage Veranstalter</a><a href="https://reg.example.at">Online - Anmeldung</a>`);
    expect(links).toEqual({ websiteUrl: "https://pamagravel.at", registrationUrl: "https://reg.example.at" });
  });

  it("parses vysledkovyservis.sk and skips running events", () => {
    const html = `
      <div class="up-event-item"><div class="ebm-event-month">máj</div><div class="ebm-event-day">18</div><a class="ebm-event-link" href="/mtb-2027">Kysucký MTB Maratón</a></div>
      <div class="up-event-item"><div class="ebm-event-month">nov</div><div class="ebm-event-day">28</div><a class="ebm-event-link" href="/beh-2026">Jesenný beh</a></div>
    `;
    const rows = parseVysledkovyServis(html, "2026-11-25");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2027-05-18", discipline: "xcm" });
  });

  it("filters endu.net slugs and parses SportsEvent JSON-LD with ISO-3 country", () => {
    expect(isEnduCyclingSlug("https://www.endu.net/events/uci-masters-cyclo-cross-world-championships")).toBe(true);
    expect(isEnduCyclingSlug("https://www.endu.net/events/3-dias-trail-ibiza-ultra-ibiza")).toBe(false);
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "SportsEvent",
      name: "UCI Masters Cyclo-Cross World Championships",
      startDate: "2026-11-27T05:00:00.000Z",
      endDate: "2026-11-29T20:00:00.000Z",
      location: { name: "Varese, VA", address: { addressLocality: "Varese", addressCountry: "ITA" } },
    })}</script>`;
    const ev = parseEnduEvent(html, "https://www.endu.net/events/uci-masters-cyclo-cross-world-championships");
    expect(ev).toMatchObject({ externalId: "endu:uci-masters-cyclo-cross-world-championships", countryHint: "IT", discipline: ["cx"], startDate: "2026-11-27", endDate: "2026-11-29" });
  });
});
