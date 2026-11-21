/**
 * 2026-11-21: Elimon Ústí MTB Cup 2027 from the organiser's poster.
 * Source: https://www.facebook.com/Ustimtbcup (official page, poster "ELIMON ÚSTÍ MTB CUP 2027").
 *
 * The poster gives five race days and an awards evening (22. 10. 2027, "Vyhlášení Jump Family"),
 * which is not a race and is left out. Venue, discipline and categories come from the previous
 * edition of each race; categories are marked `previous` (all 2026 rounds listed the same classes,
 * Bobíci 3–4 years up to Veteráni III). No 2027 regulations, fees, schedule or registration exist
 * yet; the organiser's site stays watched for them.
 *
 * Also corrects the 2026 rounds: their regulations links pointed at other races' documents
 * (Choceň XCO, Rallye Sudety). They now point at the organiser's own PDFs, and their categories
 * are taken from those PDFs.
 *
 * Usage: npx tsx scripts/seed-usti-mtb-cup-2027-2026-11-21.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint, normalizeName, slugifyEvent } from "../src/lib/domain";
import { attachEventSeries } from "../src/lib/catalog/event-series";
import { ageCategoriesFromList } from "../src/lib/age-bands";
import type { Json } from "../src/lib/supabase/tables";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const DRY = process.argv.includes("--dry");
const BY = "usti-mtb-cup 2027 seed 2026-11-21";
const SOURCE = "https://www.facebook.com/Ustimtbcup";
const WEBSITE = "https://www.ustimtbcup.cz/";
const SERIES_ID = "21e45556-3b76-4377-bd53-b8e58f325060"; // Elimon Ústí MTB CUP
const supabase = createServerSupabase();

/** Classes printed in every 2026 round's regulations. */
const CLASSES_2026 = [
  "Bobíci (*2023 - 22)", "Naděje I (*2021 - 20)", "Naděje II (*2019 - 18)", "Naděje III (*2017 - 16)",
  "Žáci I (*2015 - 14)", "Žáci II (*2013 - 12)", "Kadeti, Kadetky (2011 – 10)", "Junioři, Juniorky (2009 – 08)",
  "Ženy (2007 a starší)", "Muži (2007 - 1997)", "Veteráni I (1996 - 1987)", "Veteráni II (1986 - 1977)",
  "Veteráni III (1976 a starší)",
].map((name) => ({ name }));
const AGES = ageCategoriesFromList(CLASSES_2026, { refYear: 2026 });

const STRIZAK = "6133a277-70be-4939-87a9-c7a3ae6e0ff9"; // Střížovický vrch – Ústí nad Labem
const USTI = "0300a039-97df-4f56-9c2b-52671cfed219"; // Ústí nad Labem (Sektorové centrum, Severní Terasa)
const ADOLFOV = "6dd98c93-e6b5-478b-bb2e-c50e780a0b98";

type Race = { start: string; name: string; posterLine: string; locationId: string; disciplines: string[]; previous: string; previousSlug: string };
const RACES: Race[] = [
  { start: "2027-04-11", name: "ELIMON XC Sektorové centrum", posterLine: "11. 4. 2027 XC SEKTOROVÉ CENTRUM",
    locationId: USTI, disciplines: ["xco"], previous: "664550df-8d5c-43be-acc7-e47d9e4871c2", previousSlug: "elimon-sektorove-centrum-short-track-2025" },
  { start: "2027-05-23", name: "ELIMON XC Střížák + časovka — Velká cena Ústí", posterLine: "23. 5. 2027 XC STŘÍŽÁK + ČASOVKA – VELKÁ CENA ÚSTÍ",
    locationId: STRIZAK, disciplines: ["xco"], previous: "3615ce9e-4a7f-49e5-af60-9e192d5f2ab8", previousSlug: "elimon-xc-strizak-2026" },
  { start: "2027-06-26", name: "ELIMON XC Střížák Flow Trail obráceně", posterLine: "26. 6. 2027 XC STŘÍŽÁK FLOW TRAIL OBRÁCENĚ",
    locationId: STRIZAK, disciplines: ["xco"], previous: "98652459-0241-4120-bd85-8ecaaa8b0bcc", previousSlug: "elimon-xc-strizak-obracene-2026" },
  { start: "2027-06-27", name: "ELIMON XC Střížák Flow Trail + duatlon — Krajský přebor Ústeckého kraje", posterLine: "27. 6. 2027 XC STŘÍŽÁK FLOW TRAIL + DUATLON – Krajský přebor ústeckého kraje",
    locationId: STRIZAK, disciplines: ["xco"], previous: "3615ce9e-4a7f-49e5-af60-9e192d5f2ab8", previousSlug: "elimon-xc-strizak-2026" },
  { start: "2027-10-03", name: "ELIMON Maraton Adolfov", posterLine: "3. 10. 2027 MARATON ADOLFOV",
    locationId: ADOLFOV, disciplines: ["xcm"], previous: "5be549e5-585f-41e7-a610-a7adc19dae6f", previousSlug: "elimon-maraton-adolfov-2025" },
];

/** 2026 rounds: the organiser's own regulations, from the 2026 table on ustimtbcup.cz. */
const FIX_2026: { id: string; url: string }[] = [
  { id: "aed22a3b-282e-4560-9105-98a9f2e5553c", url: "https://www.ustimtbcup.cz/resources/f/4/84/propozice%20ELIMON%20Maraton%20ST%C5%98I%C5%BD%C3%81K%203.5.2026.pdf" },
  { id: "3615ce9e-4a7f-49e5-af60-9e192d5f2ab8", url: "https://www.ustimtbcup.cz/resources/f/4/85/propozice%20%20ELIMON%20XC%20STRIZAK%2024.5.2026.pdf" },
  { id: "98652459-0241-4120-bd85-8ecaaa8b0bcc", url: "https://www.ustimtbcup.cz/resources/f/4/86/propozice%20ELIMON%20XC%20STRIZAK%20OBR%C3%81CEN%C4%9A%2021.6.%202026.pdf" },
  { id: "830e308c-5966-4d09-8e8f-d53ef3bca384", url: "https://www.ustimtbcup.cz/resources/f/4/87/propozice%20ELIMON%20Maraton%20ST%C5%98I%C5%BD%C3%81K%2027.%209.%202026.pdf" },
];

async function lock(id: string, fields: Record<string, unknown>) {
  const { data: ex } = await supabase.from("event_overrides").select("fields,locked_fields").eq("event_id", id).maybeSingle();
  const { error } = await supabase.from("event_overrides").upsert({
    event_id: id,
    fields: { ...((ex?.fields as object) ?? {}), ...fields } as Json,
    locked_fields: [...new Set([...((ex?.locked_fields as string[]) ?? []), ...Object.keys(fields)])],
    updated_by: BY,
  }, { onConflict: "event_id" });
  if (error) throw new Error(error.message);
}

async function findExisting(race: Race): Promise<string | null> {
  const { data } = await supabase.from("events").select("id,name").eq("start_date", race.start).is("merged_into_id", null);
  const same = (data ?? []).filter((e) => /elimon|st[řr][íi][žz][áa]k|adolfov|sektorov/i.test(e.name as string));
  if (same.length > 1) throw new Error(`ambiguous ${race.start}: ${same.map((e) => e.name).join(" | ")}`);
  return (same[0]?.id as string) ?? null;
}

async function main() {
  console.log("ages", AGES.join(","));
  const now = new Date().toISOString();
  for (const race of RACES) {
    const found = await findExisting(race);
    const slug = slugifyEvent(race.name, race.start);
    console.log(`${found ? "UPDATE" : "CREATE"} ${race.start} ${race.name} -> /cs/race/${slug}`);
    if (DRY) continue;
    const row = {
      name: race.name, name_normalized: normalizeName(race.name), start_date: race.start, end_date: race.start,
      disciplines: race.disciplines, formats: race.disciplines, age_categories: AGES, age_confidence: "previous",
      audience: "mixed", status: "scheduled", visibility: "public", website_url: WEBSITE, source_kind: "official",
      event_type: "race", competition_type: "regional", level: "regional", season: "2027", location_id: race.locationId,
      timezone: "Europe/Prague", updated_at: now, last_seen_at: now,
    };
    let id = found;
    if (id) {
      const { error } = await supabase.from("events").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("events").insert({
        ...row, slug, created_at: now, fingerprint: fingerprint({ startDate: race.start, name: race.name }),
      }).select("id").single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }
    await attachEventSeries(supabase, id, SERIES_ID, { primary: true, source: BY });
    await lock(id, { name: race.name, start_date: race.start, end_date: race.start, location_id: race.locationId, website_url: WEBSITE, series_id: SERIES_ID });

    const { error: srcErr } = await supabase.from("event_sources").insert({
      event_id: id, source_url: SOURCE, kind: "official", is_canonical: true, external_id: `ustimtbcup-fb-${race.start}`,
    });
    if (srcErr && !/duplicate/i.test(srcErr.message)) throw new Error(srcErr.message);
    const facts = [
      { field: "start_date", value: race.start, source_url: SOURCE, quote: `ELIMON ÚSTÍ MTB CUP 2027: ${race.posterLine}`, method: "manual_source_review" },
      ...(["location_id", "disciplines", "age_categories"] as const).map((field) => ({
        field,
        value: field === "location_id" ? race.locationId : field === "disciplines" ? race.disciplines : AGES,
        source_url: `https://letsrace.cz/cs/race/${race.previousSlug}`,
        quote: "Inherited from the previous edition; not confirmed for 2027 until the organiser publishes regulations.",
        method: "previous_edition",
      })),
    ];
    const { error: fErr } = await supabase.from("event_facts").insert(
      facts.map((f) => ({ event_id: id, ...f, value: f.value as Json, version: "announced-edition-v1" })),
    );
    if (fErr) throw new Error(fErr.message);
  }

  for (const fix of FIX_2026) {
    console.log("FIX 2026 regulations", fix.id);
    if (DRY) continue;
    const { error } = await supabase.from("events").update({
      regulations_url: fix.url, age_categories: AGES, age_confidence: "explicit", updated_at: now,
    }).eq("id", fix.id);
    if (error) throw new Error(error.message);
    await lock(fix.id, { regulations_url: fix.url });
    await supabase.from("event_facts").insert({
      event_id: fix.id, field: "regulations_url", value: fix.url as unknown as Json, source_url: WEBSITE,
      quote: "Link in the 2026 table on the organiser's site (column Propozice a výsledky).", method: "manual_source_review", version: "announced-edition-v1",
    });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
