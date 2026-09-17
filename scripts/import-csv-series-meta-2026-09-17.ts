/**
 * Upsert every series from the curated CZ 2026 CSV: name, website, disciplines
 * (from disciplina + podtyp), audience / series_type. Does not invent races.
 *
 * Usage: nvm use 22 && npx tsx scripts/import-csv-series-meta-2026-09-17.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { normalizeName } from "../src/lib/domain";
import { seriesMetaFromCsv } from "../src/lib/catalog/csv-series-meta";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ok */
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const CSV = "/Users/radektobolka/Downloads/cyklisticke_serialy_CR_2026.csv";

/** CSV title → canonical slug (matches parsers / handoff). */
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
};

type CsvRow = {
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
      nazev: parts[0]!.trim(),
      disciplina: parts[1]!.trim(),
      podtyp: parts[2]!.trim(),
      region: parts[3]!.trim(),
      pocet: parts[4]!.trim(),
      web: parts[5]!.trim(),
      poznamka: parts[6]!.trim(),
      stav: parts[7]!.trim(),
    });
  }
  return rows;
}

function shortName(nazev: string): string {
  // Prefer the part before a slash / en-dash parenthetical clutter.
  return nazev
    .split(/\s*[–/]\s*/)[0]!
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .slice(0, 60);
}

async function main() {
  const csv = parseCsv(CSV);
  const supabase = createServerSupabase();
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (const row of csv) {
    const slug = SLUG_BY_CSV[row.nazev];
    if (!slug) {
      console.log("SKIP unmapped", row.nazev);
      continue;
    }
    const meta = seriesMetaFromCsv({
      nazev: row.nazev,
      disciplina: row.disciplina,
      podtyp: row.podtyp,
      poznamka: row.poznamka,
      slug,
    });
    const website = row.web || null;
    const { data: existing } = await supabase
      .from("series")
      .select("id, name, website_url, disciplines, audience_hint, series_type")
      .eq("slug", slug)
      .maybeSingle();

    const patch: Record<string, unknown> = {
      name: row.nazev.length <= 80 ? row.nazev : shortName(row.nazev),
      name_normalized: normalizeName(row.nazev),
      short_name: shortName(row.nazev),
      disciplines: meta.disciplines,
      audience_hint: meta.audience,
      age_categories: meta.ageCategories,
      series_type: meta.seriesType,
      country_code: "CZ",
      status: "active",
      visibility: "public",
      season: "2026",
      source_kind: "official",
      updated_at: now,
      last_seen_at: now,
    };
    if (website) {
      patch.website_url = website;
      patch.source_url = website;
    }
    if (row.poznamka) {
      patch.description = row.poznamka.slice(0, 500);
    }

    console.log(
      existing ? "UPDATE" : "CREATE",
      slug,
      meta.disciplines.join("+"),
      meta.seriesType,
      meta.audience,
      website || "(no web)",
    );

    if (DRY) continue;

    if (existing) {
      // Never blank a better website with empty CSV web.
      if (!website) {
        delete patch.website_url;
        delete patch.source_url;
      }
      const { error } = await supabase.from("series").update(patch).eq("id", existing.id);
      if (error) throw new Error(`${slug}: ${error.message}`);
      updated++;
    } else {
      const { error } = await supabase.from("series").insert({
        slug,
        ...patch,
        created_at: now,
      });
      if (error) throw new Error(`${slug}: ${error.message}`);
      created++;
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} dry=${DRY}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
