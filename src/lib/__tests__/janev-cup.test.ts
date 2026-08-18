import { describe, expect, it } from "vitest";
import { parseCyklokros } from "@/lib/watcher/extractors/cz-calendars";

const html = `
  <a href="https://www.cyklokros.cz/files/rozpis-janev-cup-2026-cyklokros-v22.pdf">ZDE</a>
  <div class="box-container">
    <h2>Chýnov</h2>
    <p><strong>Sobota 3. 10. 2026</strong></p>
    <a class="btn" href="https://www.cyklokros.cz/janev-chynov-26">více informací</a>
    <img data-srcset="https://www.cyklokros.cz/files/c1-box.png 360w" />
  </div>
  <div class="box-container">
    <h2>Holé Vrchy</h2>
    <p><strong>Sobota 17. 10. 2026</strong></p>
    <a class="btn" href="/janev-holevrchy-26">více informací</a>
    <img data-srcset="https://www.cyklokros.cz/files/c2-box.png 360w" />
  </div>
  <div class="box-container">
    <h2>Prachatice</h2>
    <p><strong>Úterý 17. 11. 2026</strong></p>
    <a class="btn" href="https://www.cyklokros.cz/janev-prachatice-26">více informací</a>
  </div>
  <div class="box-container">
    <h2>Veselí nad Lužnicí</h2>
    <p><strong>MČR mládeže</strong><br><strong>Neděle 13. 12. 2026</strong></p>
    <a class="btn" href="https://www.cyklokros.cz/janev-veseli-mcr-mladez-26">více informací</a>
    <img data-srcset="https://www.cyklokros.cz/files/trikolora-box.png 360w" />
  </div>
`;

describe("parseCyklokros Janev Cup cards", () => {
  it("reads place + weekday date from the 2026 boxes", () => {
    const events = parseCyklokros("https://www.cyklokros.cz/janev-cup-2026", html);
    expect(events.map((e) => `${e.startDate} ${e.name}`)).toEqual([
      "2026-10-03 JANEV Cup C1 — Chýnov",
      "2026-10-17 JANEV Cup C2 — Holé Vrchy",
      "2026-11-17 JANEV Cup — Prachatice",
      "2026-12-13 MČR cyklokros mládež — Veselí nad Lužnicí",
    ]);
  });

  it("points at the race page and the series rozpis", () => {
    const events = parseCyklokros("https://www.cyklokros.cz/janev-cup-2026", html);
    expect(events[0]?.websiteUrl).toBe("https://www.cyklokros.cz/janev-chynov-26");
    expect(events[0]?.sourceUrl).toBe("https://www.cyklokros.cz/janev-chynov-26");
    expect(events[0]?.regulationsUrl).toContain("rozpis-janev-cup-2026");
    expect(events[0]?.seriesSlug).toBe("janev-cup");
    expect(events[0]?.discipline).toEqual(["cx"]);
    expect(events[3]?.seriesSlug).toBe("mcr-cyclocross");
    expect(events[3]?.audience).toBe("youth");
  });
});
