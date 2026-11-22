/**
 * Upcoming races whose venue is stored without coordinates: read the document the venue came from and
 * take the coordinates it states beside the venue (src/lib/catalog/venue-coordinates.ts). Directions then
 * lead to the venue, not to a town's geocode. Nothing is guessed: no coordinates in the document, no change.
 *
 *   npx tsx scripts/fill-venue-coordinates.ts [--max=40] [--apply]
 *
 * Each changed race gets a new public revision, so its page refreshes: keep batches small.
 * Daily step: scripts/local-cycle.cjs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { readAllRows } from "../src/lib/supabase/read-all";
import { venueCoordinatesFromDocument } from "../src/lib/catalog/venue-coordinates";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const APPLY = process.argv.includes("--apply");
const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 40);
const db = createServerSupabase();

async function main() {
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const today = new Date().toISOString().slice(0, 10);
  const rows = await readAllRows((from, to) =>
    db.from("events").select("id,slug,public_revision,practical_details").eq("visibility", "public").gte("start_date", today).not("practical_details->venue", "is", null).order("id").range(from, to),
  );
  const todo = rows.filter((r) => {
    const v = (r.practical_details as Record<string, { value?: { lat?: number } }>).venue;
    return v?.value && v.value.lat == null;
  });
  console.log(`${todo.length} upcoming races have a venue without coordinates`);
  const seen = new Map<string, Promise<string | null>>();
  const textOf = (url: string) => {
    if (!seen.has(url)) {
      seen.set(url, readDocument(url, { maxBytes: 8 * 1024 * 1024 }).then((doc) => {
        if (!doc?.text?.trim()) return null;
        return doc.html ? pageAsText(doc.html, url).text : doc.text;
      }).catch(() => null));
    }
    return seen.get(url)!;
  };
  let found = 0, written = 0, unreadable = 0;
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (row) => {
      const venue = (row.practical_details as Record<string, { sourceUrl: string; quote: string; value: Record<string, unknown> }>).venue!;
      const text = await textOf(venue.sourceUrl);
      if (!text) { unreadable++; return; }
      const hit = venueCoordinatesFromDocument(text, venue.quote);
      if (!hit) return;
      found++;
      console.log(`${APPLY ? "write" : "would write"} ${row.slug} ${hit.point.lat},${hit.point.lng}  «${hit.quote.replace(/\n/g, " ⏎ ").slice(0, 140)}»`);
      if (!APPLY || written >= max) return;
      const next = { ...(row.practical_details as object), venue: { ...venue, quote: hit.quote, value: { ...venue.value, lat: hit.point.lat, lng: hit.point.lng } } };
      const { data, error } = await db.from("events").update({ practical_details: next }).eq("id", row.id).eq("public_revision", row.public_revision).select("id");
      if (error) throw new Error(`${row.slug}: ${error.message}`);
      if (!data?.length) { console.log(`  skipped ${row.slug}: changed meanwhile`); return; }
      written++;
    }));
  }
  console.log(`${found} with coordinates in their document, ${unreadable} documents unreadable; ${APPLY ? `${written} written` : "dry run"}`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
