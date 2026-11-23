import { describe, expect, it } from "vitest";
import { parseRadmarathon } from "@/lib/watcher/extractors/radmarathon";

describe("radmarathon.at extractor", () => {
  it("parses Central European cycling races and skips triathlons and non-European countries", () => {
    const html = `<ul>
      <li class="menu"><a href="detail_event.php?rmlang=de&amp;id=502" title="Stupava Winter MTB Trophy | Bratislava"><span class="blacktitle"><span class="newslistdate">16.01.2027<br /></span>Stupava Winter MTB Trophy<br /><img src="../pictures/sk.gif" alt="Slowakei" class="terminlist"> Bratislava (SK) <span class="newslistdate">- Offroad - MA</span></span></a></li>
      <li class="menu"><a href="detail_event.php?rmlang=de&amp;id=170" title="Cyclocross Cup-Finale | Salzburg"><span class="blacktitle"><span class="newslistdate">09.01.2027 - 10.01.2027<br /></span>Cyclocross Cup-Finale<br /><img src="../pictures/at.gif" alt="Österreich" class="terminlist"> Salzburg (Sbg) <span class="newslistdate">- Offroad - CC</span></span></a></li>
      <li class="menu"><a href="detail_event.php?rmlang=de&amp;id=915" title="Jogllandloipen Nacht-Wintertriathlon | St. Jakob/Walde"><span class="blacktitle"><span class="newslistdate">09.01.2027<br /></span>Jogllandloipen Nacht-Wintertriathlon<br /><img src="../pictures/at.gif" alt="Österreich" class="terminlist"> St. Jakob/Walde <span class="newslistdate">- Offroad - TA</span></span></a></li>
      <li class="menu"><a href="detail_event.php?rmlang=de&amp;id=97" title="Tankwa Trek | Kaleo Manor"><span class="blacktitle"><span class="newslistdate">11.02.2027 - 14.02.2027<br /></span>Tankwa Trek<br /><img src="../pictures/za.gif" alt="Südafrika" class="terminlist"> Kaleo Manor (ZA) <span class="newslistdate">- Offroad - SR</span></span></a></li>
    </ul>`;

    const events = parseRadmarathon("https://www.radmarathon.at/termine/", html);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      externalId: "radmarathon-502-2027-01-16",
      name: "Stupava Winter MTB Trophy",
      startDate: "2027-01-16",
      placeText: "Bratislava",
      countryHint: "SK",
      discipline: ["xcm"],
    });
    expect(events[1]).toMatchObject({
      externalId: "radmarathon-170-2027-01-09",
      startDate: "2027-01-09",
      endDate: "2027-01-10",
      countryHint: "AT",
      discipline: ["cx"],
    });
  });
});
