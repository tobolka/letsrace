import { describe, expect, it } from "vitest";
import { parseRideAndRestMonth } from "@/lib/watcher/extractors/rideandrest";

const PAGE = `<a href="https://rideandrest.net/eventi/?mese=2026-10">tutto il mese</a><ul class="rr-cal-elenco">
<li><span class="rr-cal-gg">4<small>Dom</small></span><span class="rr-cal-corpo"><a href="https://rideandrest.net/manifestazione/40-campionato-intersociale-memorial-alcide-besana/">40° CAMPIONATO INTERSOCIALE &quot;MEMORIAL ALCIDE BESANA&quot;</a><span class="rr-cal-meta">TURATE &middot; 8 km &middot; In linea  strada <span class="rr-cal-pillola">Corse amatoriali e master</span></span></span></li>
<li><span class="rr-cal-gg">4<small>Dom</small></span><span class="rr-cal-corpo"><a href="https://rideandrest.net/manifestazione/la-prevostura-pedalata-ecologica/">LA PREVOSTURA PEDALATA ECOLOGICA</a><span class="rr-cal-meta">LESSONA BI &middot; 22 km &middot; Pedalata fuoristrada <span class="rr-cal-pillola">Cicloturistiche e non competitive</span></span></span></li>
<li><span class="rr-cal-gg">3<small>Sab</small></span><span class="rr-cal-corpo"><a href="https://rideandrest.net/manifestazione/98-il-lombardia-under-23/">98° IL LOMBARDIA UNDER 23</a><span class="rr-cal-meta">OGGIONO &middot; In linea  strada <span class="rr-cal-pillola">Corse su strada</span></span></span></li>
</ul>`;

describe("Ride&Rest month", () => {
  it("reads the day, the town and the kind of each race", () => {
    const [a, b, c] = parseRideAndRestMonth(PAGE);
    expect(a).toMatchObject({ name: '40° CAMPIONATO INTERSOCIALE "MEMORIAL ALCIDE BESANA"', startDate: "2026-10-04", placeText: "TURATE, Italia", discipline: ["road"] });
    expect(a!.sourceUrl).toContain("/manifestazione/40-campionato");
    expect(b).toMatchObject({ discipline: ["mtb"], eventType: "ride" });
    expect(c).toMatchObject({ startDate: "2026-10-03", placeText: "OGGIONO, Italia" });
  });
});
