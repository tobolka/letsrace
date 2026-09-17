/**
 * Repair regional CSV import damage:
 * 1) Remove over-attached event_series from source=csv-regional
 * 2) Clear primary series_id on events that only had that bad primary
 * 3) Split series that were wrongly merged via host matching
 *
 * Usage: npx tsx scripts/repair-csv-regional-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { normalizeName } from "../src/lib/domain";
import { seriesMetaFromCsv } from "../src/lib/catalog/csv-series-meta";

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

/** Distinct series that must exist (CSV name → slug). Host matching must not merge these. */
const ENSURE: Array<{
  slug: string;
  nazev: string;
  web: string;
  country: string;
  disciplina: string;
  podtyp: string;
  poznamka?: string;
}> = [
  {
    slug: "slovensky-pohar-xco",
    nazev: "Slovenský pohár MTB XCO 2026",
    web: "https://www.cyklistikaszc.sk/sk/mtb-cross-country/kalendar",
    country: "SK",
    disciplina: "MTB",
    podtyp: "XCO / XCC",
  },
  {
    slug: "spdh",
    nazev: "Slovenský pohár MTB Downhill 2026 (SPDH)",
    web: "https://www.cyklistikaszc.sk/sk/mtb-downhill-fourcross/kalendar",
    country: "SK",
    disciplina: "MTB",
    podtyp: "DH / 4X",
  },
  {
    slug: "slovensky-pohar-pumptrack",
    nazev: "Slovenský pohár Pumptrack 2026",
    web: "https://www.cyklistikaszc.sk/sk/mtb-cross-country/kalendar",
    country: "SK",
    disciplina: "MTB",
    podtyp: "Pumptrack",
  },
  {
    slug: "slovensky-pohar-cc",
    nazev: "Slovenský pohár v cestnej cyklistike 2026 (SP CC)",
    web: "https://www.cyklistikaszc.sk/sk/cestna-cyklistika/kalendar",
    country: "SK",
    disciplina: "SILNICE",
    podtyp: "silnice / kritérium",
  },
  {
    slug: "nolimited-cup-cx",
    nazev: "NoLimited Cup v cyklokrose 2026 / Slovenský pohár CX",
    web: "https://www.cyklistikaszc.sk/sk/cyklokros",
    country: "SK",
    disciplina: "CX",
    podtyp: "cyklokros",
  },
  {
    slug: "nyna-cup-gravel",
    nazev: "NyNa CUP – Slovenský pohár v graveli 2026",
    web: "https://www.cyklistikaszc.sk/sk/gravel/spravy-a-clanky/slovensky-pohar-v-graveli-cakaju-v-roku-2026-vyrazne-novinky",
    country: "SK",
    disciplina: "GRAVEL",
    podtyp: "gravel",
  },
  {
    slug: "xco-nrw-cup",
    nazev: "XCO-NRW-Cup",
    web: "https://www.xco-nrw-cup.de/",
    country: "DE",
    disciplina: "MTB",
    podtyp: "XCO",
  },
  {
    slug: "mtb-nrw-fun-cup",
    nazev: "MTB-NRW-Fun-Cup",
    web: "https://www.xco-nrw-cup.de/",
    country: "DE",
    disciplina: "MTB",
    podtyp: "XCO / hobby",
  },
  {
    slug: "mtb-schuler-cup-nrw",
    nazev: "MTB-Schüler-Cup NRW",
    web: "https://www.xco-nrw-cup.de/",
    country: "DE",
    disciplina: "MTB",
    podtyp: "XCO / mládež",
  },
  {
    slug: "austrian-gravity-series",
    nazev: "auner Austrian Gravity Series",
    web: "https://www.lines-mag.at/austrian-gravity-series/",
    country: "AT",
    disciplina: "MTB",
    podtyp: "DH / Enduro",
  },
  {
    slug: "schneefrasn",
    nazev: "schneefräsn powered by LINES",
    web: "https://www.lines-mag.at/schneefraesn/",
    country: "AT",
    disciplina: "MTB",
    podtyp: "DH",
  },
  {
    slug: "mountainbike-challenge",
    nazev: "KTM Mountainbike Challenge",
    web: "https://www.mountainbike-challenge.at/",
    country: "AT",
    disciplina: "MTB",
    podtyp: "XCM / maraton",
  },
  {
    slug: "mountainbike-challenge-de",
    nazev: "Mountainbike Challenge",
    web: "https://www.mountainbike-challenge.de/",
    country: "DE",
    disciplina: "MTB",
    podtyp: "XCM / maraton",
  },
  {
    slug: "junior-mtb-challenge",
    nazev: "Junior MTB Challenge",
    web: "https://www.mountainbike-challenge.at/",
    country: "AT",
    disciplina: "MTB",
    podtyp: "XCM / mládež",
  },
];

/** Old slug that was overwritten with wrong series → restore if still wrong. */
const RESTORE_NAME: Array<{ slug: string; name: string; web: string }> = [
  {
    slug: "slovensky-pohar-mtb-xc",
    name: "Slovenský pohár MTB XC",
    web: "https://www.cyklistikaszc.sk/sk/mtb-cross-country/kalendar",
  },
];

function shortName(nazev: string): string {
  return nazev
    .replace(/\s+20\d{2}\s*$/, "")
    .split(/\s*[–/]\s*/)[0]!
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .slice(0, 60);
}

async function main() {
  const sb = createServerSupabase();
  const now = new Date().toISOString();

  // --- 1) Detach bad csv-regional memberships ---
  const { data: badLinks, error: badErr } = await sb
    .from("event_series")
    .select("event_id, series_id, is_primary")
    .eq("source", "csv-regional");
  if (badErr) throw badErr;
  console.log(`csv-regional memberships: ${badLinks?.length ?? 0}`);

  const primaryEventIds = [
    ...new Set((badLinks || []).filter((l) => l.is_primary).map((l) => l.event_id as string)),
  ];

  if (!DRY && (badLinks?.length ?? 0) > 0) {
    // Clear events.series_id when this membership was the primary badge we set
    for (let i = 0; i < primaryEventIds.length; i += 100) {
      const chunk = primaryEventIds.slice(i, i + 100);
      const { error } = await sb
        .from("events")
        .update({ series_id: null, updated_at: now })
        .in("id", chunk);
      if (error) throw error;
    }
    console.log(`cleared series_id on ${primaryEventIds.length} events`);

    const { error: delErr } = await sb.from("event_series").delete().eq("source", "csv-regional");
    if (delErr) throw delErr;
    console.log("deleted csv-regional event_series rows");
  } else {
    console.log(`[dry] would clear ${primaryEventIds.length} primaries and delete memberships`);
  }

  // --- 2) Ensure distinct series exist with correct meta ---
  let created = 0;
  let updated = 0;
  for (const row of ENSURE) {
    const meta = seriesMetaFromCsv({
      nazev: row.nazev,
      disciplina: row.disciplina,
      podtyp: row.podtyp,
      poznamka: row.poznamka || "",
      slug: row.slug,
    });
    const patch = {
      name: row.nazev.length <= 90 ? row.nazev : shortName(row.nazev),
      name_normalized: normalizeName(row.nazev),
      short_name: shortName(row.nazev),
      website_url: row.web,
      source_url: row.web,
      country_code: row.country,
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
    const { data: existing } = await sb.from("series").select("id").eq("slug", row.slug).maybeSingle();
    if (existing) {
      if (!DRY) {
        const { error } = await sb.from("series").update(patch).eq("id", existing.id);
        if (error) throw new Error(`${row.slug}: ${error.message}`);
      }
      updated++;
      console.log(`update ${row.slug}`);
    } else {
      if (!DRY) {
        const { error } = await sb.from("series").insert({ slug: row.slug, ...patch, created_at: now });
        if (error) throw new Error(`${row.slug}: ${error.message}`);
      }
      created++;
      console.log(`create ${row.slug}`);
    }
  }

  for (const r of RESTORE_NAME) {
    if (DRY) continue;
    await sb
      .from("series")
      .update({
        name: r.name,
        name_normalized: normalizeName(r.name),
        short_name: shortName(r.name),
        website_url: r.web,
        source_url: r.web,
        updated_at: now,
      })
      .eq("slug", r.slug);
    console.log(`restore ${r.slug}`);
  }

  console.log({ dry: DRY, created, updated, clearedPrimaries: primaryEventIds.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
