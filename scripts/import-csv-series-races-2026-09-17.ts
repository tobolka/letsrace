/**
 * Batch-ingest calendars for every series in the CZ 2026 CSV.
 * Official URL first; sumator cup as fallback when official yields nothing.
 *
 * Usage: nvm use 22 && npx tsx scripts/import-csv-series-races-2026-09-17.ts [--dry] [--only=slug]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl, watchOne } from "../src/lib/watcher/run";
import { listEvents } from "../src/lib/events";
import { attachSecondarySeries } from "../src/lib/catalog/event-series";
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
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

type Target = {
  csv: string;
  slug: string;
  official?: string[];
  fallback?: string[];
  expected?: number;
};

/** Prefer official calendar URLs; sumator only as fallback. */
const TARGETS: Target[] = [
  { csv: "Český pohár MTB XCO", slug: "cesky-pohar-mtb", official: ["https://www.poharmtb.cz/cross-country"], expected: 7 },
  { csv: "Český pohár MTB XCM", slug: "cesky-pohar-mtb-xcm", official: ["https://www.poharmtb.cz/maraton"], expected: 4 },
  { csv: "Kolo pro život", slug: "kolo-pro-zivot", official: ["https://www.kolopro.cz/zavody/"], expected: 8 },
  { csv: "Prima CUP", slug: "primacup", official: ["https://www.iprimacup.cz/zavody-2026/"], expected: 11 },
  { csv: "Author Maraton Tour", slug: "author-maraton-tour", official: ["https://cz.author.eu/maraton-tour/author-maraton-tour-2026"], fallback: ["https://sumator.cz/cup/author-maraton-tour-2026"], expected: 5 },
  { csv: "Galaxy série", slug: "galaxy-serie", official: ["https://www.galaxy-serie.cz/", "https://www.mtbmaratonsusice.cz/"], fallback: ["https://sumator.cz/cup/galaxy-serie-2026"], expected: 5 },
  { csv: "ŠKODA Pražský MTB pohár", slug: "prazsky-mtb-pohar", official: ["https://prahamtb.cz/?page_id=12"], expected: 4 },
  { csv: "Talent Cup", slug: "talent-cup", official: ["https://talentcup.cz/?tcdesignindex=data/zavody.php"], expected: 8 },
  { csv: "PKK HK", slug: "pohar-kv-kraje-hk", official: ["https://www.pkk-hk.cz/?pkkdesignindex=data/zavody.php"], expected: 10 },
  { csv: "PPKBIKE", slug: "ppkbike", official: ["https://ppkbike.cz/ppk-races.js"], expected: 8 },
  { csv: "Šumavský pohár MTB", slug: "sumavsky-mtb-pohar", official: ["https://jcp-mtb.cz/"], expected: 6 },
  { csv: "Pohár Drahanské vrchoviny", slug: "pohar-drahanske-vrchoviny", official: ["https://www.pohardrahanskevrchoviny.cz/"], fallback: ["https://sumator.cz/cup/pohar-drahanske-vrchoviny-2026"], expected: 7 },
  { csv: "Peklo Severu MTB", slug: "peklo-severu", official: ["https://www.pekloseveru.cz/cz/rocnik-2026/propozice-serialu/"], expected: 5 },
  { csv: "Dětský MTB Cup", slug: "detsky-mtb-cup", official: ["https://www.detskymtbcup.cz/"], expected: 8 },
  { csv: "KUKLÍK XCO", slug: "kuklik-xco", official: ["https://www.kuklikxco.cz/"], expected: 6 },
  { csv: "Kolo kolem komína", slug: "kolo-kolem-komina", official: ["https://www.kolokolemkomina.cz/"], expected: 8 },
  { csv: "Inspiro MTB Cup", slug: "inspiro-mtb-cup", official: ["https://www.svcinspiro.cz/inspiro-mtb-cup"], expected: 3 },
  { csv: "Středeční pohár", slug: "stredecni-pohar", official: ["https://stredecnipohar.cz/"], expected: 7 },
  { csv: "Jesenický šnek", slug: "jesenicky-snek", official: ["https://jesenickysnek.cz/"], fallback: ["https://sumator.cz/cup/jesenicky-snek-2026"], expected: 14 },
  { csv: "Jihočeský MTB pohár", slug: "jihocesky-mtb-pohar", official: ["https://www.jihoceskymtbpohar.cz/cup/autovinkler-jihocesky-mtb-pohar-2026"], expected: 6 },
  { csv: "Cykloman Abner Cup", slug: "cykloman-abner-cup", official: ["https://www.cykloman.cz/"], expected: 10 },
  { csv: "Cyklománek", slug: "cyklomanek", official: ["https://www.cykloman.cz/cyklomanek-2026"], expected: 8 },
  { csv: "Šumperský pohár MTB", slug: "sumpersky-pohar-mtb", official: ["https://www.spmtb.cz/"], expected: undefined },
  { csv: "Valašský pohár MTB-XC", slug: "valassky-pohar-mtb-xc", official: ["https://www.edieteam.cz/mtb-mladeze"], expected: 4 },
  { csv: "Ostravský MTB pohár", slug: "ostravsky-mtb-pohar", official: ["https://www.mtbpohar.cz/"], expected: 4 },
  { csv: "VKCT", slug: "vkct", official: ["https://vkct.webnode.cz/"], expected: 5 },
  { csv: "JAPA CUP", slug: "japa-cup", official: ["https://www.japasport.cz/japa-cup-2026/"], expected: 5 },
  { csv: "Povltavský bikerský pohár", slug: "povltavsky-bikersky-pohar", official: ["https://www.da-ba.com/"], fallback: ["https://sumator.cz/cup/povltavsky-bikersky-pohar-2026"], expected: 5 },
  { csv: "Česká Enduro Serie", slug: "czech-enduro-series", official: ["https://www.enduroserie.cz/zavody/"], expected: 6 },
  { csv: "Fresh Enduro Tour", slug: "fresh-enduro-tour", official: [], fallback: [], expected: 3 },
  { csv: "FOX Grom Enduro", slug: "fox-grom-enduro", official: ["https://serialy.sportsoft.cz/"], fallback: ["https://sumator.cz/cup/fox-grom-enduro-2026"], expected: 5 },
  { csv: "Czech Downhill Top on Trail Cup", slug: "czech-downhill-top-on-trail-cup", official: ["https://www.topontrail.cz/czech-downhill-top-on-trail-cup"], expected: 5 },
  { csv: "Wood Bikerally Series", slug: "wood-bikerally-series", official: ["https://woodbikerallyseries.cz/"], fallback: ["https://sumator.cz/cup/wood-bikerally-series-2026"], expected: 7 },
  { csv: "Blinduro King & Queen", slug: "blinduro-king-queen", official: ["https://www.blinduro.com/"], expected: undefined },
  { csv: "ŠKODA CUP", slug: "skoda-cup", official: ["https://www.czechcyclingfederation.com/events/skoda-cup/"], fallback: ["https://sumator.cz/cup/skoda-cup-2026"], expected: 7 },
  { csv: "MND CUP", slug: "mnd-cup", official: ["https://www.czechcyclingfederation.com/events/mnd-cup/"], fallback: ["https://sumator.cz/cup/mnd-cup-2026"], expected: 8 },
  { csv: "RoadCup", slug: "roadcup", official: ["https://www.roadcycling.cz/roadcup/rocnik-2026"], expected: undefined },
  { csv: "SAL", slug: "severoceska-amaterska-liga", official: ["https://www.amaterskaliga.cz/"], fallback: ["https://sumator.cz/cup/severoceska-amaterska-liga-2026"], expected: 14 },
  { csv: "ZAL", slug: "zal", official: ["https://zapadoceskaamaterskaliga.cz/kalendare/zal-2026"], expected: 15 },
  { csv: "JAL", slug: "jihoceska-amaterska-liga", official: ["https://www.jalcyklo.cz/"], fallback: ["https://sumator.cz/cup/jihoceska-amaterska-liga-2026"], expected: 15 },
  { csv: "SPAC", slug: "slezsky-pohar-amaterskych-cyklistu", official: ["https://spac-os.cz/sezona-2026/"], fallback: ["https://sumator.cz/cup/slezsky-pohar-amaterskych-cyklistu-2026"], expected: 14 },
  { csv: "ČPP Extraliga Masters", slug: "cpp-extraliga-masters", official: ["https://www.extraligamasters.cz/calendar", "https://www.extraligamasters.cz/"], fallback: ["https://sumator.cz/cup/cpp-extraliga-masters-2026"], expected: 16 },
  { csv: "Direct Road Classics", slug: "road-classics", official: ["https://www.roadclassics.cz/serial-roadclassics"], fallback: ["https://sumator.cz/cup/road-classics-2026"], expected: 3 },
  { csv: "Peklo Severu Road", slug: "peklo-severu-road", official: ["https://www.pekloseveruroad.cz/"], fallback: ["https://sumator.cz/cup/peklo-severu-road-2026"], expected: 4 },
  { csv: "JANEV Cup", slug: "janev-cup", official: ["https://www.cyklokros.cz/janev-cup-2026"], expected: 8 },
  { csv: "TBC série", slug: "tbc-cyclocross", official: ["https://tbcserie.cz/kalendar-2026"], expected: 11 },
  { csv: "Oderský pohár", slug: "odersky-pohar", official: ["https://www.kolarna.eu/k/zavody/"], expected: 12 },
];

async function ensureWatched(url: string, kind: string, notes: string) {
  const supabase = createServerSupabase();
  const { data: row } = await supabase.from("watched_urls").select("*").eq("url", url).maybeSingle();
  if (row) {
    if (row.status !== "active") {
      await supabase
        .from("watched_urls")
        .update({ status: "active", next_poll_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return { ...(row as object), status: "active" } as typeof row;
    }
    return row;
  }
  const { data, error } = await supabase
    .from("watched_urls")
    .insert({
      url,
      kind,
      status: "active",
      added_by: "csv-import-2026-09-17",
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
  const list = ONLY ? TARGETS.filter((t) => t.slug === ONLY) : TARGETS;
  const report: Record<string, unknown>[] = [];

  for (const t of list) {
    console.log(`\n===== ${t.csv} (${t.slug})`);
    const urls = [...(t.official || []), ...(t.fallback || [])];
    let bestPreview = { url: "", count: 0, strategy: "", events: [] as Awaited<ReturnType<typeof previewUrl>>["events"] };
    for (const url of urls) {
      try {
        const p = await previewUrl(url);
        const n = p.events?.length ?? 0;
        console.log(`  preview ${n} ${p.strategy || ""} ${url}`);
        if (n > bestPreview.count) {
          bestPreview = { url, count: n, strategy: p.strategy || "", events: p.events || [] };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  preview ERR ${url} ${msg}`);
      }
    }

    let written = 0;
    let extracted = 0;
    if (!DRY && bestPreview.url && bestPreview.count > 0) {
      const row = await ensureWatched(
        bestPreview.url,
        "series",
        `CSV import 2026-09-17 — ${t.csv}`,
      );
      const result = await watchOne({
        id: row.id as string,
        url: row.url as string,
        etag: (row.etag as string | null) ?? null,
        last_modified: (row.last_modified as string | null) ?? null,
        content_hash: (row.content_hash as string | null) ?? null,
        kind: (row.kind as string | undefined) ?? "series",
        last_extract_status: (row.last_extract_status as string | null) ?? null,
      });
      written = result?.eventsUpserted ?? 0;
      extracted = result?.eventsExtracted ?? 0;
      console.log(
        `  watchOne upserted=${written} extracted=${extracted} ok=${result?.ok} err=${result?.error || ""}`,
      );
    }

    // Force-attach any previewed events that landed without this series slug
    // (e.g. sumator wrote a different series) — secondary membership if primary taken.
    if (!DRY && bestPreview.events.length) {
      const supabase = createServerSupabase();
      const { data: series } = await supabase.from("series").select("id").eq("slug", t.slug).maybeSingle();
      if (series?.id) {
        for (const ev of bestPreview.events) {
          if (!ev.startDate || !ev.name) continue;
          const fp = fingerprint({ startDate: ev.startDate, name: ev.name, lat: ev.lat, lng: ev.lng });
          const { data: hit } = await supabase
            .from("events")
            .select("id, series_id, name")
            .eq("fingerprint", fp)
            .is("merged_into_id", null)
            .maybeSingle();
          if (!hit) {
            // try date + name overlap
            const { data: day } = await supabase
              .from("events")
              .select("id, series_id, name")
              .eq("start_date", ev.startDate)
              .is("merged_into_id", null)
              .ilike("name", `%${normalizeName(ev.name).split(" ").slice(0, 2).join("%")}%`)
              .limit(3);
            const match = (day || []).find((d) => normalizeName(d.name).includes(normalizeName(ev.name).slice(0, 12)));
            if (match) {
              await attachSecondarySeries(supabase, match.id, series.id, "csv-import");
            }
            continue;
          }
          if (hit.series_id === series.id) continue;
          await attachSecondarySeries(supabase, hit.id, series.id, "csv-import");
        }
      }
    }

    let dbCount = 0;
    let rounds: string[] = [];
    try {
      const listed = await listEvents({ seriesSlug: t.slug });
      dbCount = listed.length;
      rounds = listed.map((e) => `${e.startDate} ${e.name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("  listEvents ERR", msg);
    }

    const status =
      t.expected != null && dbCount >= t.expected
        ? "complete"
        : bestPreview.count === 0
          ? "no_calendar"
          : dbCount >= bestPreview.count
            ? "complete_vs_preview"
            : dbCount > 0
              ? "partial"
              : "empty";

    report.push({
      csv: t.csv,
      slug: t.slug,
      expected: t.expected ?? null,
      preview: bestPreview.count,
      previewUrl: bestPreview.url || null,
      strategy: bestPreview.strategy || null,
      written,
      dbCount,
      status,
      rounds,
    });
    console.log(`  => db=${dbCount} expected=${t.expected ?? "?"} status=${status}`);
  }

  writeFileSync("/tmp/csv-import-report.json", JSON.stringify(report, null, 2));
  console.log("\nWrote /tmp/csv-import-report.json");
  const by = (s: string) => report.filter((r) => r.status === s).length;
  console.log("complete", by("complete") + by("complete_vs_preview"));
  console.log("partial", by("partial"));
  console.log("empty", by("empty"));
  console.log("no_calendar", by("no_calendar"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
