/**
 * Final verify of all regional CSV series → /tmp/csv-regional-final.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { listEvents } from "../src/lib/events";
import { normalizeName } from "../src/lib/domain";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const CSV =
  "/Users/radektobolka/Downloads/cyklisticke_serialy_CZ_AT_SK_DE_PL_2026_vcetne_gravelu.csv";

const SLUG_BY_CSV: Record<string, string> = {
  "Český pohár MTB XCO": "cesky-pohar-mtb",
  "Český pohár MTB XCM": "cesky-pohar-mtb-xcm",
  "Kolo pro život": "kolo-pro-zivot",
  "Prima CUP": "primacup",
  "Author Maraton Tour": "author-maraton-tour",
  "Galaxy série": "galaxy-serie",
  "ŠKODA Pražský MTB pohár": "prazsky-mtb-pohar",
  "Talent Cup": "talent-cup",
  "PKK HK / Pohár Karlovarského kraje horských kol": "pohar-kv-kraje-hk",
  "PPKBIKE – Pohár Plzeňského kraje MTB XCO": "ppkbike",
  "Šumavský pohár MTB": "sumavsky-mtb-pohar",
  "Pohár Drahanské vrchoviny": "pohar-drahanske-vrchoviny",
  "Peklo Severu MTB": "peklo-severu",
  "Dětský MTB Cup Libereckého kraje": "detsky-mtb-cup",
  "KUKLÍK XCO": "kuklik-xco",
  "Kolo kolem komína": "kolo-kolem-komina",
  "Inspiro MTB Cup": "inspiro-mtb-cup",
  "Středeční pohár horských kol / Joy.bike Cup": "stredecni-pohar",
  "Jesenický šnek": "jesenicky-snek",
  "AutoVinkler Jihočeský MTB pohár": "jihocesky-mtb-pohar",
  "Cykloman Abner Cup": "cykloman-abner-cup",
  "Cyklománek Ori bikeservis cup": "cyklomanek",
  "Šumperský pohár MTB": "sumpersky-pohar-mtb",
  "Valašský pohár MTB-XC": "valassky-pohar-mtb-xc",
  "Ostravský MTB pohár": "ostravsky-mtb-pohar",
  "Valašskokarpatská cyklotour (VKCT)": "vkct",
  "JAPA CUP": "japa-cup",
  "Povltavský bikerský pohár": "povltavsky-bikersky-pohar",
  "Česká Enduro Serie": "czech-enduro-series",
  "Fresh Enduro Tour": "fresh-enduro-tour",
  "FOX Grom Enduro": "fox-grom-enduro",
  "Czech Downhill Top on Trail Cup": "czech-downhill-top-on-trail-cup",
  "Gergel Wood Bikerally Series (WBS)": "wood-bikerally-series",
  "Blinduro King & Queen": "blinduro-king-queen",
  "ŠKODA CUP": "skoda-cup",
  "MND CUP": "mnd-cup",
  RoadCup: "roadcup",
  "Severočeská amatérská liga (SAL)": "severoceska-amaterska-liga",
  "Západočeská amatérská liga (ZAL)": "zal",
  "Jihočeská amatérská liga (JAL)": "jihoceska-amaterska-liga",
  "SPAC – Slezský pohár amatérských cyklistů": "slezsky-pohar-amaterskych-cyklistu",
  "ČPP Extraliga Masters": "cpp-extraliga-masters",
  "Direct Road Classics": "road-classics",
  "Peklo Severu Road": "peklo-severu-road",
  "JANEV Cup": "janev-cup",
  "TBC série": "tbc-cyclocross",
  "KOLÁRNA–CBA Oderský pohár": "odersky-pohar",
  "KOLÁRNA–CBA Oderski Puchar 2026": "odersky-pohar",
  "Gravel Bohemia Cup 2026": "gravel-bohemia-cup",
  "Decathlon Gravel Series 2026": "gravel-series",
  "Gravelking UCI Gravel World Series – Gravel Tour Hlinsko": "uci-gravel-world-series-hlinsko",
  "Mountainbike League Austria": "mountainbike-liga",
  "Austria Marathon Cup (ÖRV Marathon Cup)": "austria-marathon-cup",
  "Mountainbike Austria Amateur Cup (AAC)": "sportklasse-cup",
  "Austria Youngsters Cup (AYC)": "austrian-youngsters-cup",
  "KTM Mountainbike Challenge": "mountainbike-challenge",
  "Junior MTB Challenge": "junior-mtb-challenge",
  "Austria Top Tour": "austria-top-tour",
  "German Cycling MTB-Bundesliga": "bundesliga",
  "XCO-Bikecup": "xco-bikecup",
  "Bayerwald MTB Cup": "bayerwald-mtb-cup",
  "Puchar Polski MTB XCO 2026": "puchar-polski-xco",
  "LOTTO Poland Bike Marathon 2026": "poland-bike",
  "MTB Pomerania Maraton 2026": "mtb-pomerania",
  "Slovenský pohár MTB XCO 2026": "slovensky-pohar-xco",
  "ŠKODA Bike Open Tour 2026": "skoda-bike-open-tour",
  "Slovenský pohár MTB Enduro 2026 (KENNY SPEN)": "spen",
  "Slovenský pohár MTB Downhill 2026 (SPDH)": "spdh",
  "Slovenský pohár Pumptrack 2026": "slovensky-pohar-pumptrack",
  "Slovenský pohár v cestnej cyklistike 2026 (SP CC)": "slovensky-pohar-cc",
  "NoLimited Cup v cyklokrose 2026 / Slovenský pohár CX": "nolimited-cup-cx",
  "NyNa CUP – Slovenský pohár v graveli 2026": "nyna-cup-gravel",
  "XCO-NRW-Cup": "xco-nrw-cup",
  "MTB-NRW-Fun-Cup": "mtb-nrw-fun-cup",
  "MTB-Schüler-Cup NRW": "mtb-schuler-cup-nrw",
  "auner Austrian Gravity Series": "austrian-gravity-series",
  "schneefräsn powered by LINES": "schneefrasn",
  "Mountainbike Challenge": "mountainbike-challenge-de",
  "Mountainbike Challenge (DE/AT)": "mountainbike-challenge-de",
  "eldoRADo Kids-Cup": "eldorado-kids-cup",
  "iXS Downhill Cup": "ixs-downhill-cup",
  "MarathonMan Europe": "marathon-man",
  "Schwarzwälder ADAC Mountainbike Cup": "schwarzwaelder-mtb-cup",
  "Riese & Müller MTB Rhein-Main-Cup": "mtb-rhein-main-cup",
  "LVM MTB Saarlandliga": "mtb-saarlandliga",
  "PROPAIN Rookies Cup": "rookies-dh-cup",
  "Müller – Die lila Logistik Rad-Bundesliga": "rad-bundesliga",
  "Silesia Bike MTB Maraton 2026": "silesia-bike",
  "Junior Bike Cup Salzburg": "junior-bike-cup",
  "Šarišská mini séria MTB (VRL)": "sarisska-mini-seria",
};

function parseCsv(path: string) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const rows: {
    stat: string;
    nazev: string;
    disciplina: string;
    podtyp: string;
    pocet: string;
    web: string;
    poznamka: string;
  }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of lines[i]!) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ";" && !inQ) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    rows.push({
      stat: parts[0]!.trim(),
      nazev: parts[1]!.trim(),
      disciplina: parts[2]!.trim(),
      podtyp: parts[3]!.trim(),
      pocet: parts[5]!.trim(),
      web: parts[6]!.trim(),
      poznamka: parts[7]!.trim(),
    });
  }
  return rows;
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "series"
  );
}

function parseExpected(pocet: string): number | null {
  const m = pocet.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  const csv = parseCsv(CSV);
  const sb = createServerSupabase();
  const { data: allSeries } = await sb.from("series").select("id, slug, name, website_url");
  const bySlug = new Map((allSeries || []).map((s) => [s.slug as string, s]));
  const byNorm = new Map(
    (allSeries || []).map((s) => [normalizeName(s.name as string), s] as const),
  );

  const report: Record<string, unknown>[] = [];
  const seenSlug = new Set<string>();
  let complete = 0;
  let partial = 0;
  let empty = 0;
  let missingSeries = 0;
  let totalRaces = 0;
  let uniqueSeries = 0;

  for (const row of csv) {
    let slug = SLUG_BY_CSV[row.nazev] || slugify(row.nazev.replace(/\s+20\d{2}\s*$/, ""));
    let s = bySlug.get(slug);
    if (!s) {
      const n = normalizeName(row.nazev);
      s = byNorm.get(n) || byNorm.get(normalizeName(row.nazev.replace(/\s+20\d{2}\s*$/, "")));
      if (s) slug = s.slug as string;
    }
    const expected = parseExpected(row.pocet);
    let dbCount = 0;
    let races: { startDate: string; name: string }[] = [];
    if (s) {
      try {
        const listed = await listEvents({ seriesSlug: slug });
        races = listed.map((e) => ({ startDate: e.startDate, name: e.name }));
        dbCount = listed.length;
      } catch {
        dbCount = 0;
      }
    }

    let status = "empty";
    if (!s) status = "missing_series";
    else if (!row.web && dbCount === 0) status = "no_web";
    else if (expected != null && dbCount >= expected) status = "complete";
    else if (dbCount > 0 && expected != null && dbCount < expected) status = "partial";
    else if (dbCount > 0) status = "ok";
    else status = "no_calendar";

    if (status === "complete") complete++;
    else if (status === "partial" || status === "ok") partial++;
    else if (status === "missing_series") missingSeries++;
    else empty++;

    if (!seenSlug.has(slug)) {
      seenSlug.add(slug);
      uniqueSeries++;
      totalRaces += dbCount;
    }

    report.push({
      stat: row.stat,
      csv: row.nazev,
      slug,
      web: row.web || null,
      expected,
      dbCount,
      status,
      disciplina: row.disciplina,
      podtyp: row.podtyp,
      found: !!s,
      sampleRaces: races.slice(0, 3),
    });
  }

  const manual = report.filter((r) =>
    ["no_calendar", "partial", "no_web", "missing_series", "empty"].includes(r.status as string),
  );

  const out = {
    csvRows: csv.length,
    uniqueSeries,
    complete,
    partial,
    empty,
    missingSeries,
    totalRacesLinked: totalRaces,
    series: report,
    manual,
  };
  writeFileSync("/tmp/csv-regional-final.json", JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      {
        csvRows: out.csvRows,
        uniqueSeries,
        complete,
        partial,
        empty,
        missingSeries,
        totalRacesLinked: totalRaces,
        manualNeedingHelp: manual.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
