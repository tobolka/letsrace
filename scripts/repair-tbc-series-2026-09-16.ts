/**
 * TBC série cyklokros showed 5 of 11 races.
 *
 * Hynek's calendar labels the series "TBC SÉRIE", and with no alias for that
 * label the watcher minted a second series row (tbc-serie) beside the official
 * tbc-cyclocross. Six races landed in one, five in the other, and the series
 * filter only ever shows one. The extractor now maps the label onto the
 * official slug; this folds the rows that already split.
 *
 * Along the way the season-points registration row on maraton.cz ("TBC série
 * 2026 - přihláška do bodování") had renamed the Bernartice opener and left a
 * ghost event, and the run.ts child filter had let every /zavod- race page
 * become a source. Both are fixed in code; this cleans up what they left.
 *
 * Usage: nvm use 22 && npx tsx scripts/repair-tbc-series-2026-09-16.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

const DUPLICATE_SERIES = "1252cac4-29eb-42f1-af4c-5b8a7dbc4db3"; // tbc-serie
const OFFICIAL_SERIES = "43d4d2fa-c2bd-4ff5-a0da-0d4a8c1491eb"; // tbc-cyclocross
const BERNARTICE = "438e1659-6bcd-40d1-a217-c924130b7791";
const GHOST = "2f6efb9a-9eea-4867-a582-1717485f9ade"; // "TBC série 2026", no sources

async function main() {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data: dup } = await supabase
    .from("series")
    .select("id,slug")
    .eq("id", DUPLICATE_SERIES)
    .maybeSingle();
  const { data: official } = await supabase
    .from("series")
    .select("id,slug")
    .eq("id", OFFICIAL_SERIES)
    .maybeSingle();
  if (official?.slug !== "tbc-cyclocross") throw new Error("Official series changed identity");

  if (dup) {
    if (dup.slug !== "tbc-serie") throw new Error("Duplicate series changed identity");
    const { data: moved, error } = await supabase
      .from("events")
      .update({ series_id: OFFICIAL_SERIES, updated_at: now })
      .eq("series_id", DUPLICATE_SERIES)
      .select("id");
    if (error) throw new Error(error.message);
    console.log(`moved ${moved?.length ?? 0} events into tbc-cyclocross`);
    const { error: delErr } = await supabase.from("series").delete().eq("id", DUPLICATE_SERIES);
    if (delErr) throw new Error(delErr.message);
    console.log("deleted series tbc-serie");
  } else {
    console.log("series tbc-serie already gone");
  }

  // The opener wears the registration row's title; give it the race's name and
  // keep the watcher from taking it back.
  const name = "TBC — Bernartický cyklokros";
  const { error: nameErr } = await supabase
    .from("events")
    .update({ name, updated_at: now })
    .eq("id", BERNARTICE)
    .eq("start_date", "2026-09-20");
  if (nameErr) throw new Error(nameErr.message);
  const { data: existingOverride } = await supabase
    .from("event_overrides")
    .select("fields,locked_fields")
    .eq("event_id", BERNARTICE)
    .maybeSingle();
  const fields = { ...((existingOverride?.fields as Record<string, unknown>) ?? {}), name };
  const locked = [
    ...new Set([...((existingOverride?.locked_fields as string[]) ?? []), "name"]),
  ];
  const { error: ovErr } = await supabase.from("event_overrides").upsert(
    {
      event_id: BERNARTICE,
      fields,
      locked_fields: locked,
      updated_by: "tbc series repair 2026-09-16",
    },
    { onConflict: "event_id" },
  );
  if (ovErr) throw new Error(ovErr.message);
  console.log("renamed Bernartice and locked its name");

  const { data: ghost } = await supabase
    .from("events")
    .update({ status: "hidden", updated_at: now })
    .eq("id", GHOST)
    .eq("name", "TBC série 2026")
    .is("series_id", null)
    .select("id");
  console.log(`hid ${ghost?.length ?? 0} ghost registration event`);

  // Race pages are not calendars; the filter that let them in is fixed.
  const { data: paused } = await supabase
    .from("watched_urls")
    .update({ status: "paused", updated_at: now })
    .like("url", "https://tbcserie.cz/kalendar-20__/zavod-%")
    .eq("status", "active")
    .select("url");
  console.log(`paused ${paused?.length ?? 0} /zavod- sources`);

  const { data: visible } = await supabase
    .from("events")
    .select("start_date,name")
    .eq("series_id", OFFICIAL_SERIES)
    .neq("status", "hidden")
    .order("start_date");
  console.log(`\ntbc-cyclocross now lists ${visible?.length ?? 0} races:`);
  for (const e of visible ?? []) console.log(`  ${e.start_date}  ${e.name}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
