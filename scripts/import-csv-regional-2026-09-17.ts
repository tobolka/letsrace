/**
 * Import series + races from the regional CZ/AT/SK/DE/PL 2026 CSV
 * (including gravel). Upserts series metadata from disciplina/podtyp,
 * then for each official URL: preview → ensure watched → watchOne when
 * an adapter returns events. Never invents race rows.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/import-csv-regional-2026-09-17.ts [--dry] [--meta-only] [--races-only]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { normalizeName } from "../src/lib/domain";
import { seriesMetaFromCsv } from "../src/lib/catalog/csv-series-meta";
import { previewUrl, watchOne } from "../src/lib/watcher/run";
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

const DRY = process.argv.includes("--dry");
const META_ONLY = process.argv.includes("--meta-only");
const RACES_ONLY = process.argv.includes("--races-only");
const CSV =
  "/Users/radektobolka/Downloads/cyklisticke_serialy_CZ_AT_SK_DE_PL_2026_vcetne_gravelu.csv";

/** Known canonical slugs (parsers / prior CZ import). Key = CSV nazev. */
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
  "Puchar Polski w Maratonie MTB XCM 2026": "puchar-polski-w-maratonie-mtb-xcm",
  "Puchar Polski Pumptrack 2026": "puchar-polski-pumptrack",
  "Puchar Polski w kolarstwie szosowym 2026": "puchar-polski-w-kolarstwie-szosowym",
  "Puchar Polski w kolarstwie przełajowym 2026/27": "puchar-polski-w-kolarstwie-prze-ajowym-2026-27",
  "Super Puchar Polski CX 2026/27": "super-puchar-polski-cx-2026-27",
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

/** Federation / multi-series hosts — never merge distinct CSV rows by host alone. */
const MULTI_SERIES_HOSTS = new Set([
  "cyklistikaszc.sk",
  "pzkol.pl",
  "xco-nrw-cup.de",
  "lines-mag.at",
  "mountainbike-challenge.at",
  "radsportverband-nrw.de",
  "dsergebnis.de",
]);

type CsvRow = {
  stat: string;
  nazev: string;
  disciplina: string;
  podtyp: string;
  region: string;
  pocet: string;
  web: string;
  poznamka: string;
  stav: string;
};

function parseCsv(path: string): CsvRow[] {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const rows: CsvRow[] = [];
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
      region: parts[4]!.trim(),
      pocet: parts[5]!.trim(),
      web: parts[6]!.trim(),
      poznamka: parts[7]!.trim(),
      stav: parts[8]!.trim(),
    });
  }
  return rows;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "series";
}

function shortName(nazev: string): string {
  return nazev
    .replace(/\s+20\d{2}\s*$/, "")
    .split(/\s*[–/]\s*/)[0]!
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .slice(0, 60);
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

async function ensureWatched(url: string, notes: string) {
  const supabase = createServerSupabase();
  const { data: row } = await supabase.from("watched_urls").select("*").eq("url", url).maybeSingle();
  if (row) {
    if (row.status !== "active") {
      await supabase
        .from("watched_urls")
        .update({
          status: "active",
          next_poll_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    return row;
  }
  const { data, error } = await supabase
    .from("watched_urls")
    .insert({
      url,
      kind: "series",
      status: "active",
      added_by: "csv-regional-2026-09-17",
      notes,
      next_poll_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`${url}: ${error.message}`);
  return data!;
}

async function main() {
  const csv = parseCsv(CSV);
  console.log("CSV rows:", csv.length);
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: allSeries } = await supabase.from("series").select("id, slug, name, website_url");
  type SeriesRow = { id: string; slug: string; name: string; website_url: string | null };
  const seriesRows = (allSeries || []) as SeriesRow[];
  const bySlug = new Map(seriesRows.map((s) => [s.slug, s]));
  const byHost = new Map<string, SeriesRow[]>();
  for (const s of seriesRows) {
    const h = hostOf(s.website_url || "");
    if (!h) continue;
    if (!byHost.has(h)) byHost.set(h, []);
    byHost.get(h)!.push(s);
  }

  let created = 0;
  let updated = 0;
  const report: Record<string, unknown>[] = [];

  for (const row of csv) {
    const known = SLUG_BY_CSV[row.nazev];
    const guessed = slugify(row.nazev.replace(/\s+20\d{2}\s*$/, ""));
    let slug = known || guessed;
    let existing = bySlug.get(slug);

    // Host-based merge only when we don't already have an explicit slug mapping
    // and the host is not a federation calendar that hosts many series.
    if (!existing && !known && row.web) {
      const h = hostOf(row.web);
      if (h && !MULTI_SERIES_HOSTS.has(h)) {
        const cands = byHost.get(h) || [];
        const target = normalizeName(row.nazev);
        const hit = cands.find((c) => {
          const n = normalizeName(c.name as string);
          return n === target || n.includes(target) || target.includes(n);
        });
        if (hit && cands.filter((c) => hostOf((c.website_url as string) || "") === h).length === 1) {
          existing = hit;
          slug = hit.slug as string;
        }
      }
    }

    const meta = seriesMetaFromCsv({
      nazev: row.nazev,
      disciplina: row.disciplina,
      podtyp: row.podtyp,
      poznamka: row.poznamka,
      slug,
    });
    const website = row.web || null;
    const country = row.stat.length === 2 ? row.stat.toUpperCase() : null;
    const expected = parseExpected(row.pocet);

    if (!RACES_ONLY) {
      const patch: Record<string, unknown> = {
        name: row.nazev.length <= 90 ? row.nazev : shortName(row.nazev),
        name_normalized: normalizeName(row.nazev),
        short_name: shortName(row.nazev),
        disciplines: meta.disciplines,
        audience_hint: meta.audience,
        age_categories: meta.ageCategories,
        series_type: meta.seriesType,
        status: "active",
        visibility: "public",
        season: "2026",
        source_kind: "official",
        updated_at: now,
        last_seen_at: now,
      };
      if (country) patch.country_code = country;
      if (website) {
        patch.website_url = website;
        patch.source_url = website;
      }
      if (row.poznamka) patch.description = row.poznamka.slice(0, 500);

      if (!DRY) {
        if (existing) {
          if (!website) {
            delete patch.website_url;
            delete patch.source_url;
          }
          const { error } = await supabase.from("series").update(patch).eq("id", existing.id);
          if (error) throw new Error(`${slug}: ${error.message}`);
          updated++;
        } else {
          const { data, error } = await supabase
            .from("series")
            .insert({ slug, ...patch, created_at: now })
            .select("id, slug, name, website_url")
            .single();
          if (error) throw new Error(`${slug}: ${error.message}`);
          existing = data!;
          bySlug.set(slug, data!);
          created++;
        }
      } else if (!existing) {
        created++;
      } else {
        updated++;
      }
    }

    let previewCount = 0;
    let previewUrlUsed: string | null = null;
    let strategy: string | null = null;
    let upserted = 0;
    let dbCount = 0;
    let status = "pending";

    if (!META_ONLY && website) {
      try {
        const p = await previewUrl(website);
        previewCount = p.events?.length ?? 0;
        strategy = p.strategy || null;
        if (previewCount > 0) {
          previewUrlUsed = website;
          if (!DRY) {
            const watched = await ensureWatched(website, `CSV regional — ${row.nazev}`);
            // Let watchOne assign series via parser seriesSlug / official-host rules.
            // Do NOT bulk-attach every previewed event — federation calendars return
            // mixed series and would over-link (pzkol.pl, cyklistikaszc.sk, …).
            const result = await watchOne({
              id: watched.id as string,
              url: watched.url as string,
              etag: (watched.etag as string | null) ?? null,
              last_modified: (watched.last_modified as string | null) ?? null,
              content_hash: (watched.content_hash as string | null) ?? null,
              kind: (watched.kind as string | undefined) ?? "series",
              last_extract_status: (watched.last_extract_status as string | null) ?? null,
            });
            upserted = result?.eventsUpserted ?? 0;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        strategy = `error:${msg.slice(0, 80)}`;
      }
    }

    try {
      const listed = await listEvents({ seriesSlug: slug });
      dbCount = listed.length;
    } catch {
      dbCount = 0;
    }

    if (expected != null && dbCount >= expected) status = "complete";
    else if (dbCount > 0 && (expected == null || dbCount >= Math.max(1, (expected || 0) - 2)))
      status = expected == null ? "partial_unknown" : dbCount > 0 ? "partial" : "empty";
    else if (dbCount > 0) status = "partial";
    else if (!website) status = "no_web";
    else if (previewCount === 0) status = "no_calendar";
    else status = "empty";

    if (expected != null && dbCount >= expected) status = "complete";
    else if (dbCount === 0 && !website) status = "no_web";
    else if (dbCount === 0 && previewCount === 0) status = "no_calendar";
    else if (dbCount === 0) status = "empty";
    else if (expected != null && dbCount < expected) status = "partial";
    else status = "ok";

    report.push({
      stat: row.stat,
      csv: row.nazev,
      slug,
      web: website,
      expected,
      previewCount,
      previewUrl: previewUrlUsed,
      strategy,
      upserted,
      dbCount,
      status,
      disciplina: row.disciplina,
      podtyp: row.podtyp,
    });

    console.log(
      `${row.stat} ${status.padEnd(14)} db=${String(dbCount).padStart(2)} prev=${String(previewCount).padStart(2)} ${slug}`,
    );
  }

  writeFileSync(
    "/tmp/csv-regional-report.json",
    JSON.stringify({ created, updated, dry: DRY, series: report }, null, 2),
  );
  const counts: Record<string, number> = {};
  for (const r of report) counts[r.status as string] = (counts[r.status as string] || 0) + 1;
  console.log("\n=== SUMMARY ===");
  console.log({ created, updated, dry: DRY, counts, total: report.length });
  console.log("wrote /tmp/csv-regional-report.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
