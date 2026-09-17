/**
 * Safely attach previewed events to regional CSV series.
 * Skips federation / multi-series hosts that return mixed calendars.
 *
 * Usage: npx tsx scripts/attach-csv-regional-safe-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl } from "../src/lib/watcher/run";
import { listEvents } from "../src/lib/events";
import { attachEventSeries, attachSecondarySeries } from "../src/lib/catalog/event-series";
import { fingerprint, normalizeName } from "../src/lib/domain";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const CSV =
  "/Users/radektobolka/Downloads/cyklisticke_serialy_CZ_AT_SK_DE_PL_2026_vcetne_gravelu.csv";

const MULTI_SERIES_HOSTS = new Set([
  "cyklistikaszc.sk",
  "pzkol.pl",
  "xco-nrw-cup.de",
  "lines-mag.at",
  "mountainbike-challenge.at",
  "radsportverband-nrw.de",
  "dsergebnis.de",
  "czechcyclingfederation.com",
  "sumator.cz",
]);

/** Explicit slug overrides (same as import script). */
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
};

function parseCsv(path: string) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const rows: { nazev: string; web: string; pocet: string; stat: string }[] = [];
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
      pocet: parts[5]!.trim(),
      web: parts[6]!.trim(),
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function parseExpected(pocet: string): number | null {
  const m = pocet.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  const csv = parseCsv(CSV);
  const sb = createServerSupabase();
  let attachedTotal = 0;
  let skippedFed = 0;
  let skippedFat = 0;

  // Dedupe by slug (cross-border duplicates share one series)
  const seen = new Set<string>();

  for (const row of csv) {
    const slug = SLUG_BY_CSV[row.nazev] || slugify(row.nazev.replace(/\s+20\d{2}\s*$/, ""));
    if (seen.has(slug)) continue;
    seen.add(slug);
    if (!row.web) continue;
    const host = hostOf(row.web);
    if (MULTI_SERIES_HOSTS.has(host)) {
      skippedFed++;
      continue;
    }

    const { data: series } = await sb.from("series").select("id").eq("slug", slug).maybeSingle();
    if (!series?.id) {
      console.log("MISSING", slug);
      continue;
    }

    let events: Awaited<ReturnType<typeof previewUrl>>["events"] = [];
    try {
      const p = await previewUrl(row.web);
      events = p.events || [];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`SKIP ${slug} preview error: ${msg.slice(0, 60)}`);
      continue;
    }
    if (!events.length) continue;

    const expected = parseExpected(row.pocet);
    // Reject fat mixed calendars
    if (expected != null && events.length > expected + 5 && events.length > 20) {
      console.log(`FAT ${slug} prev=${events.length} exp=${expected}`);
      skippedFat++;
      continue;
    }
    if (expected == null && events.length > 25) {
      console.log(`FAT ${slug} prev=${events.length} (no expected)`);
      skippedFat++;
      continue;
    }

    let attached = 0;
    for (const ev of events) {
      if (!ev.startDate || !ev.name) continue;
      const fp = fingerprint({ startDate: ev.startDate, name: ev.name, lat: ev.lat, lng: ev.lng });
      let eventId: string | null = null;
      const { data: byFp } = await sb
        .from("events")
        .select("id, series_id")
        .eq("fingerprint", fp)
        .is("merged_into_id", null)
        .maybeSingle();
      if (byFp) eventId = byFp.id as string;
      if (!eventId) {
        const tokens = normalizeName(ev.name)
          .split(" ")
          .filter((t) => t.length > 3)
          .slice(0, 2);
        if (tokens.length) {
          const { data: day } = await sb
            .from("events")
            .select("id, name, series_id")
            .eq("start_date", ev.startDate)
            .is("merged_into_id", null)
            .ilike("name", `%${tokens.join("%")}%`)
            .limit(8);
          const hit =
            (day || []).find((d) => normalizeName(d.name) === normalizeName(ev.name)) ||
            ((day || []).length === 1 ? day![0] : null);
          if (hit) eventId = hit.id as string;
        }
      }
      if (!eventId) continue;
      if (!DRY) {
        const { data: cur } = await sb.from("events").select("series_id").eq("id", eventId).maybeSingle();
        if (!cur?.series_id) {
          await attachEventSeries(sb, eventId, series.id, { primary: true, source: "csv-regional-safe" });
        } else if (cur.series_id !== series.id) {
          await attachSecondarySeries(sb, eventId, series.id, "csv-regional-safe");
        } else {
          await attachEventSeries(sb, eventId, series.id, { primary: true, source: "csv-regional-safe" });
        }
      }
      attached++;
    }
    const listed = DRY ? [] : await listEvents({ seriesSlug: slug });
    console.log(
      `${row.stat} ${slug} prev=${events.length} attached=${attached} db=${listed.length}${DRY ? " [dry]" : ""}`,
    );
    attachedTotal += attached;
  }

  console.log({ dry: DRY, attachedTotal, skippedFed, skippedFat, seriesTried: seen.size });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
