/** Merge the same Kukle cyclocross race from the official TBC and Maraton calendars. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { mergeEventPair } from "../src/lib/catalog/merge-duplicates";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

const KEEP = "49fee2df-1c3f-4eba-be52-a7814d0d927b";
const DROP = "efd0bf97-042e-41af-9dc9-ec2dfdadf0dd";

async function main() {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("events")
    .select("id,name,start_date,merged_into_id,location:locations(lat,lng),sources:event_sources(source_url)")
    .in("id", [KEEP, DROP]);
  if (error || data?.length !== 2) throw new Error(error?.message ?? "Reviewed pair missing");
  const keep = data.find((row) => row.id === KEEP);
  const drop = data.find((row) => row.id === DROP);
  const loc = (row: typeof keep) => Array.isArray(row?.location) ? row?.location[0] : row?.location;
  if (!keep || !drop || keep.name !== "Galaxy Cyklošvec cyklokros Kukle" ||
      drop.name !== "Kukelský cyklokros" || keep.start_date !== "2026-09-26" ||
      drop.start_date !== keep.start_date || keep.merged_into_id || drop.merged_into_id ||
      loc(keep)?.lat !== loc(drop)?.lat || loc(keep)?.lng !== loc(drop)?.lng ||
      !keep.sources?.some((source) => source.source_url.includes("tbcserie.cz/kalendar-2026/zavod-197"))) {
    throw new Error("Kukle identity changed; review before merging");
  }
  console.log(`${drop.name} → ${keep.name} (${keep.start_date}, same coordinates)`);
  if (!process.argv.includes("--apply")) return console.log("Dry run only");
  await mergeEventPair(KEEP, DROP);
  console.log("Merged");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
