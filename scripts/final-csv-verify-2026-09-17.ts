/**
 * Final verification of all 47 CSV series after import.
 * Writes /tmp/csv-final-report.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { listEvents } from "../src/lib/events";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const ROWS: { csv: string; slug: string; web: string; expected: number | null; note?: string }[] = [
  { csv: "Český pohár MTB XCO", slug: "cesky-pohar-mtb", web: "https://www.poharmtb.cz/cross-country", expected: 7 },
  { csv: "Český pohár MTB XCM", slug: "cesky-pohar-mtb-xcm", web: "https://www.poharmtb.cz/maraton", expected: 4 },
  { csv: "Kolo pro život", slug: "kolo-pro-zivot", web: "https://www.kolopro.cz/", expected: 8 },
  { csv: "Prima CUP", slug: "primacup", web: "https://www.iprimacup.cz/", expected: 11 },
  { csv: "Author Maraton Tour", slug: "author-maraton-tour", web: "https://cz.author.eu/maraton-tour/author-maraton-tour-2026", expected: 5 },
  { csv: "Galaxy série", slug: "galaxy-serie", web: "https://www.galaxy-serie.cz/", expected: 5 },
  { csv: "ŠKODA Pražský MTB pohár", slug: "prazsky-mtb-pohar", web: "https://prahamtb.cz/", expected: 4 },
  { csv: "Talent Cup", slug: "talent-cup", web: "https://talentcup.cz/", expected: 8 },
  { csv: "PKK HK", slug: "pohar-kv-kraje-hk", web: "https://www.pkk-hk.cz/", expected: 10 },
  { csv: "PPKBIKE", slug: "ppkbike", web: "https://ppkbike.cz/", expected: 8 },
  { csv: "Šumavský pohár MTB", slug: "sumavsky-mtb-pohar", web: "https://jcp-mtb.cz/", expected: 6 },
  { csv: "Pohár Drahanské vrchoviny", slug: "pohar-drahanske-vrchoviny", web: "https://www.pohardrahanskevrchoviny.cz/", expected: 7 },
  { csv: "Peklo Severu MTB", slug: "peklo-severu", web: "https://www.pekloseveru.cz/", expected: 5 },
  { csv: "Dětský MTB Cup", slug: "detsky-mtb-cup", web: "https://www.detskymtbcup.cz/", expected: 8 },
  { csv: "KUKLÍK XCO", slug: "kuklik-xco", web: "https://www.kuklikxco.cz/", expected: 6 },
  { csv: "Kolo kolem komína", slug: "kolo-kolem-komina", web: "https://www.kolokolemkomina.cz/", expected: 8 },
  { csv: "Inspiro MTB Cup", slug: "inspiro-mtb-cup", web: "https://www.svcinspiro.cz/inspiro-mtb-cup", expected: 3 },
  { csv: "Středeční pohár / Joy.bike Cup", slug: "stredecni-pohar", web: "https://stredecnipohar.cz/", expected: 7 },
  { csv: "Jesenický šnek", slug: "jesenicky-snek", web: "https://jesenickysnek.cz/", expected: 14 },
  { csv: "Jihočeský MTB pohár", slug: "jihocesky-mtb-pohar", web: "https://jihoceskymtbpohar.cz/", expected: 6 },
  { csv: "Cykloman Abner Cup", slug: "cykloman-abner-cup", web: "https://www.cykloman.cz/", expected: 10 },
  { csv: "Cyklománek", slug: "cyklomanek", web: "https://www.cykloman.cz/cyklomanek-2026", expected: 8 },
  { csv: "Šumperský pohár MTB", slug: "sumpersky-pohar-mtb", web: "https://www.spmtb.cz/", expected: null },
  { csv: "Valašský pohár MTB-XC", slug: "valassky-pohar-mtb-xc", web: "https://www.edieteam.cz/mtb-mladeze", expected: 4 },
  { csv: "Ostravský MTB pohár", slug: "ostravsky-mtb-pohar", web: "https://www.mtbpohar.cz/", expected: 4 },
  { csv: "VKCT", slug: "vkct", web: "https://vkct.webnode.cz/", expected: 5 },
  { csv: "JAPA CUP", slug: "japa-cup", web: "https://www.japasport.cz/japa-cup-2026/", expected: 5 },
  { csv: "Povltavský bikerský pohár", slug: "povltavsky-bikersky-pohar", web: "https://www.da-ba.com/", expected: 5 },
  { csv: "Česká Enduro Serie", slug: "czech-enduro-series", web: "https://www.enduroserie.cz/", expected: 6 },
  { csv: "Fresh Enduro Tour", slug: "fresh-enduro-tour", web: "", expected: 3 },
  { csv: "FOX Grom Enduro", slug: "fox-grom-enduro", web: "https://serialy.sportsoft.cz/", expected: 5 },
  { csv: "Czech Downhill Top on Trail Cup", slug: "czech-downhill-top-on-trail-cup", web: "https://www.topontrail.cz/czech-downhill-top-on-trail-cup", expected: 5 },
  { csv: "Wood Bikerally Series", slug: "wood-bikerally-series", web: "https://woodbikerallyseries.cz/", expected: 7 },
  { csv: "Blinduro King & Queen", slug: "blinduro-king-queen", web: "https://www.blinduro.com/", expected: null },
  { csv: "ŠKODA CUP", slug: "skoda-cup", web: "https://www.czechcyclingfederation.com/events/skoda-cup/", expected: 7 },
  { csv: "MND CUP", slug: "mnd-cup", web: "https://www.czechcyclingfederation.com/events/mnd-cup/", expected: 8 },
  { csv: "RoadCup", slug: "roadcup", web: "https://www.roadcycling.cz/roadcup/rocnik-2026", expected: null },
  { csv: "SAL", slug: "severoceska-amaterska-liga", web: "https://www.amaterskaliga.cz/", expected: 14 },
  { csv: "ZAL", slug: "zal", web: "https://zapadoceskaamaterskaliga.cz/", expected: 15 },
  { csv: "JAL", slug: "jihoceska-amaterska-liga", web: "https://www.jalcyklo.cz/", expected: 15 },
  { csv: "SPAC", slug: "slezsky-pohar-amaterskych-cyklistu", web: "https://spac-os.cz/sezona-2026/", expected: 14 },
  { csv: "ČPP Extraliga Masters", slug: "cpp-extraliga-masters", web: "https://www.extraligamasters.cz/", expected: 16 },
  { csv: "Direct Road Classics", slug: "road-classics", web: "https://www.roadclassics.cz/serial-roadclassics", expected: 3 },
  { csv: "Peklo Severu Road", slug: "peklo-severu-road", web: "https://www.pekloseveruroad.cz/", expected: 4 },
  { csv: "JANEV Cup", slug: "janev-cup", web: "https://www.cyklokros.cz/", expected: 8 },
  { csv: "TBC série", slug: "tbc-cyclocross", web: "https://www.tbcserie.cz/", expected: 11 },
  { csv: "Oderský pohár", slug: "odersky-pohar", web: "https://www.kolarna.eu/kolarna-cba-odersky-pohar-2026/", expected: 12 },
];

async function main() {
  const supabase = createServerSupabase();
  const out: Array<
    (typeof ROWS)[number] & {
      exists: boolean;
      seriesName: string | null;
      websiteDb: string | null;
      disciplines: unknown;
      dbCount: number;
      status: string;
      rounds: string[];
    }
  > = [];
  let totalRaces = 0;
  for (const row of ROWS) {
    const { data: s } = await supabase
      .from("series")
      .select("id, name, website_url, disciplines, series_type")
      .eq("slug", row.slug)
      .maybeSingle();
    let races: { startDate: string; name: string }[] = [];
    if (s) {
      try {
        races = await listEvents({ seriesSlug: row.slug });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(row.slug, "list ERR", msg);
      }
    }
    totalRaces += races.length;
    const ok =
      s &&
      (row.expected == null
        ? races.length > 0
        : races.length >= row.expected || (row.expected >= 10 && races.length >= row.expected - 2));
    const status = !s
      ? "missing_series"
      : row.expected != null && races.length >= row.expected
        ? "complete"
        : races.length > 0
          ? "partial"
          : "empty";
    out.push({
      ...row,
      exists: !!s,
      seriesName: s?.name ?? null,
      websiteDb: s?.website_url ?? null,
      disciplines: s?.disciplines ?? [],
      dbCount: races.length,
      status,
      rounds: races.map((r) => `${r.startDate} ${r.name}`),
    });
    console.log(`${status.padEnd(14)} ${String(races.length).padStart(2)}/${row.expected ?? "?"}  ${row.slug}`);
  }
  writeFileSync("/tmp/csv-final-report.json", JSON.stringify({ totalRaces, series: out }, null, 2));
  const c = (s: string) => out.filter((x) => x.status === s).length;
  console.log("\ncomplete", c("complete"), "partial", c("partial"), "empty", c("empty"));
  console.log("totalRaces", totalRaces);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
