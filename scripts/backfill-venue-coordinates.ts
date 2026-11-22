/**
 * Venues read before the reader kept coordinates: add the coordinates their own quoted line gives
 * ("Místo konání: Areál RAC Sedlčany (GPS: 49.6689N, 14.4300E)"). Nothing is fetched and nothing is
 * guessed: a venue gets coordinates only when its stored quote states them. Directions on the race
 * page and card lead to them, instead of to a town's geocode that may sit kilometres away.
 *
 *   npx tsx scripts/backfill-venue-coordinates.ts          dry run: lists the races
 *   npx tsx scripts/backfill-venue-coordinates.ts --apply  writes them
 *
 * Each changed race gets a new public revision, so the public pages refresh: apply in small batches.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { gpsFromText } from "../src/lib/gps-text";
import { readAllRows } from "../src/lib/supabase/read-all";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const APPLY = process.argv.includes("--apply");
const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 50);
const db = createServerSupabase();

async function main() {
  const rows = await readAllRows((from, to) =>
    db.from("events").select("id,slug,start_date,public_revision,practical_details").not("practical_details->venue", "is", null).gte("start_date", new Date().toISOString().slice(0, 10)).order("id").range(from, to),
  );
  let todo = 0, written = 0;
  for (const row of rows) {
    const venue = (row.practical_details as Record<string, { quote?: string; value?: Record<string, unknown> }>).venue;
    if (!venue?.value || venue.value.lat != null) continue;
    const gps = gpsFromText(venue.quote ?? "");
    if (!gps) continue;
    todo++;
    console.log(`${APPLY ? "write" : "would write"} ${row.slug} ${gps.lat},${gps.lng}  «${venue.quote!.slice(0, 90)}»`);
    if (!APPLY || written >= max) continue;
    const next = { ...(row.practical_details as object), venue: { ...venue, value: { ...venue.value, lat: gps.lat, lng: gps.lng } } };
    const { data, error } = await db.from("events").update({ practical_details: next }).eq("id", row.id).eq("public_revision", row.public_revision).select("id");
    if (error) throw new Error(`${row.slug}: ${error.message}`);
    // The race changed while this ran: leave it for the next run rather than overwrite.
    if (!data?.length) { console.log(`  skipped ${row.slug}: changed meanwhile`); continue; }
    written++;
  }
  console.log(`${todo} races have a venue whose line gives coordinates; ${APPLY ? `${written} written` : "dry run"}`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
