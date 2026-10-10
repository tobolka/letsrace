import { describe, expect, it } from "vitest";
import { mergeKeeper, type MergeDuplicateRow } from "@/lib/catalog/merge-duplicates";
import { preferEventName } from "@/lib/dedup";
import { looksLikeTextFragment } from "@/lib/text";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { decodeBody } from "@/lib/watcher/http";

/**
 * On 2026-09-17 a date-first bulk scrape named ~540 rows with the text around
 * each date on a calendar page, and a Czech bike shop on Windows-1250 kept being
 * listed as a race called "CYKLO�VEC s.r.o.". These are real names from
 * that run, and the real races they were cut from.
 */
const FRAGMENTS = [
  "> Sa, | 09.00&ndash;17.00 Uhr MUD MASTER CYCLOCROSS Mittelk&auml;rnten von Mountain Sport Union Kl",
  "ten [FOTOS HIER] Samstag, &ndash; Pumptrack Wiener Neustadt Zur Anmeldung",
  "07.2026 8. Rennen - RC Ritzlfuchser - 9. Rennen - SC Eisen�rzt - 10. Rennen",
  "Runden zu absolvieren.&hellip; Mehr erfahren 10 Oktober 2026",
  "CYKLO�VEC s.r.o.",
  "Kaumberger Bergzeitfahren Kaumberg Ergebnisse Rudi Bike Race Ochsenburg 28.06.2026 Ergebnisse „Mucki",
  "29.03.2026 Owińska 10.05.2026 Lgiń Cichowo 30.08.2026 Wilkowice 20.09.2026 Biegi Przyłęk 03.05.2026",
  "treckenrennen) ▶ Ausschreibung (Stand: ) ▶ Kurzbeschreibung Rennstrecke × Rundstreckenrennen",
];

const REAL_NAMES = [
  "MUD MASTER CYCLOCROSS Mittelkärnten",
  "Park-Cross Böheimkirchen",
  "Mistrzostwa Polski w kolarstwie szosowym - jazda na czas i jazda parami w kategorii Masters",
  "5. kolo Slovenského pohára v pumptracku a 4. kolo PUMPCUP 2026 Nové Zámky",
  "17. Hügellandtrophy 14.06.2026",
  "Mad Liepāja (29.08.2026 - 30.08.2026)",
  "MČR Gravel Bedřichov - Výsledky",
  "Kriterium des RSV Speiche e.V. Leipzig",
  "Pott’s Leeze Tour",
];

describe("looksLikeTextFragment", () => {
  it.each(FRAGMENTS)("flags %s", (name) => {
    expect(looksLikeTextFragment(name)).toBe(true);
  });

  it.each(REAL_NAMES)("leaves %s alone", (name) => {
    expect(looksLikeTextFragment(name)).toBe(false);
  });

  it("gives the same answer on every call", () => {
    const name = "BRS PUMPTRACK RACE 28.6.2026 DONOVALY 29.6.2026";
    expect([1, 2, 3].map(() => looksLikeTextFragment(name))).toEqual([true, true, true]);
  });
});

describe("preferEventName", () => {
  it("never lets a longer slice of page text beat the race's own title", () => {
    const fragment = FRAGMENTS[0]!;
    const clean = "MUD MASTER CYCLOCROSS Mittelkärnten";
    expect(preferEventName(fragment, clean)).toBe(clean);
    expect(preferEventName(clean, fragment)).toBe(clean);
  });
});

describe("mergeKeeper", () => {
  const row = (over: Partial<MergeDuplicateRow>): MergeDuplicateRow => ({
    id: "x",
    name: "",
    start_date: "2026-10-31",
    end_date: null,
    website_url: null,
    registration_url: null,
    series_id: null,
    fingerprint: null,
    location: null,
    series: null,
    sources: [],
    ...over,
  });

  it("keeps the cleanly named row even when the fragment holds the series and links", () => {
    const fragment = row({
      id: "fragment",
      name: FRAGMENTS[0]!,
      series_id: "cx-cup",
      website_url: "https://www.mountainsport.at/cyclocross/2026",
      registration_url: "https://example.at/anmeldung",
    });
    const clean = row({ id: "clean", name: "MUD MASTER CYCLOCROSS Mittelkärnten" });
    expect(mergeKeeper(fragment, clean).id).toBe("clean");
    expect(mergeKeeper(clean, fragment).id).toBe("clean");
  });
});

describe("decodeBody", () => {
  // "CYKLOŠVEC" in Windows-1250: Š is 0x8A, which is not valid UTF-8 on its own.
  const cp1250 = new Uint8Array([
    ...Buffer.from("<title>CYKLO", "latin1"),
    0x8a,
    ...Buffer.from("VEC s.r.o. | Prodej kol</title>", "latin1"),
  ]);

  it("reads the charset the header declares", () => {
    expect(decodeBody(cp1250, "text/html; charset=windows-1250")).toContain("CYKLOŠVEC");
  });

  it("falls back to the page's <meta> when the header has none", () => {
    const withMeta = new Uint8Array([
      ...Buffer.from('<meta http-equiv="Content-type" content="text/html; charset=windows-1250" />'),
      ...cp1250,
    ]);
    expect(decodeBody(withMeta, "text/html")).toContain("CYKLOŠVEC");
  });

  it("believes the <meta> over a header that claims UTF-8 for bytes that are not", () => {
    const withMeta = new Uint8Array([...Buffer.from('<meta charset="windows-1250">'), ...cp1250]);
    expect(decodeBody(withMeta, "text/html; charset=utf-8")).toContain("CYKLOŠVEC");
  });

  it("keeps UTF-8 pages behind a stock latin-1 header readable", () => {
    const utf8 = new TextEncoder().encode("<h1>Mittelkärnten Radquerfeldein</h1>");
    expect(decodeBody(utf8, "text/html; charset=iso-8859-1")).toContain("Mittelkärnten");
  });
});

describe("generic extractor on a Windows-1250 shop homepage", () => {
  it("recognises the shop's own name once the page is decoded, and lists no race", () => {
    const html = decodeBody(
      new Uint8Array([
        ...Buffer.from("<html><head><title>CYKLO", "latin1"),
        0x8a,
        ...Buffer.from(
          "VEC s.r.o. | Prodej kol</title></head><body>Akce 18.10.2026</body></html>",
          "latin1",
        ),
      ]),
      "text/html; charset=windows-1250",
    );
    expect(extractGeneric("https://cyklosvec.cz", html)).toEqual([]);
  });
});
