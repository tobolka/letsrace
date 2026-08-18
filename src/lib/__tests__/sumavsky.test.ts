import { describe, expect, it } from "vitest";
import { parseSumavskyPohar } from "@/lib/watcher/extractors/kids-mtb-cups";

const html = `
  <section id="races-calendar">
    <a href="#race_waldkirchen" class="calendar-item">26.4.2026 Waldkirchen</a>
  </section>
  <section id="race_waldkirchen" class="race-item">
    <h2>Waldkirchen</h2>
    <div class="date-info">16.08.2026</div>
    <table>
      <tr><th>TERMÍN</th><td>Neděle 26.4.2026</td></tr>
      <tr><th>Propozice</th><td>
        <a href="https://my.raceresult.com/382691/info">Oficiální propozice</a>
        <a href="https://rscwaldkirchen.de/plakat.jpg">Oficiální plakát</a>
      </td></tr>
      <tr><th>Přihlášky</th><td><a href="/registrace.html#waldkirchen">Online registrace</a></td></tr>
    </table>
  </section>
  <section id="race_nova-pec" class="race-item">
    <h2>Nová Pec</h2>
    <div class="date-info">16.08.2026</div>
    <table>
      <tr><th>TERMÍN</th><td>Neděle 3.5.2026</td></tr>
      <tr><th>Propozice</th><td><a href="assets/nova-pec.pdf">Oficiální propozice</a></td></tr>
    </table>
  </section>
  <section id="race_vimperk" class="race-item">
    <h2>Vimperk</h2>
    <div class="date-info">16.08.2026</div>
    <table>
      <tr><th>TERMÍN</th><td>Neděle 30.8.2026</td></tr>
      <tr><th>Propozice</th><td>
        <a href="https://docs.google.com/document/d/abc/edit">Oficiální propozice</a>
      </td></tr>
    </table>
    <h3>ROUVY Velká cena Vimperka MTB XCO</h3>
  </section>
`;

describe("parseSumavskyPohar", () => {
  it("reads TERMÍN, not the placeholder date-info, and keeps Waldkirchen in Germany", () => {
    const events = parseSumavskyPohar("https://jcp-mtb.cz/", html);
    expect(events.map((e) => `${e.startDate} ${e.placeText} ${e.countryHint}`)).toEqual([
      "2026-04-26 Waldkirchen DE",
      "2026-05-03 Nová Pec CZ",
      "2026-08-30 Vimperk CZ",
    ]);
  });

  it("uses the official Vimperk title and race-section website", () => {
    const events = parseSumavskyPohar("https://jcp-mtb.cz/", html);
    const vimperk = events.find((e) => e.placeText === "Vimperk");
    expect(vimperk?.name).toBe("ROUVY Velká cena Vimperka MTB XCO");
    expect(vimperk?.websiteUrl).toBe("https://jcp-mtb.cz/#race_vimperk");
    expect(vimperk?.regulationsUrl).toContain("docs.google.com");
  });

  it("keeps RaceResult propozice and the series registration page", () => {
    const events = parseSumavskyPohar("https://jcp-mtb.cz/", html);
    const wald = events.find((e) => e.placeText === "Waldkirchen");
    expect(wald?.regulationsUrl).toBe("https://my.raceresult.com/382691/info");
    expect(wald?.registrationUrl).toBe("https://jcp-mtb.cz/registrace.html#waldkirchen");
    expect(wald?.websiteUrl).toBe("https://jcp-mtb.cz/#race_waldkirchen");
  });
});
