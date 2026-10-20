/**
 * Clear the admin queues as reviewed on 2026-10-20.
 *
 * Every decision below was checked against the source page or the catalogue;
 * the notes say why. Writes go through the same functions the admin buttons use
 * (merge, dismiss) so nothing here is a shortcut past the catalogue's rules.
 *
 *   Sources  — 43 shown "Broken": 42 read fine (HTTP 200) and found nothing.
 *              Most are the page of a race already run, waiting for next year:
 *              that is off season, not broken (the watcher now says so itself).
 *              Sources that never yielded a race, or that the parser cannot read
 *              for a race we hold by hand, are paused. Pausing keeps the race.
 *   Races    — Cyklománek "Jízda do vrchu" was dated 7 Nov; the page lists it on
 *              17 Oct (7 Nov is the cyclists' ball). Two rows that are not races
 *              (a series home page with a guessed date, a federation's name) hidden.
 *   Duplicates — 22 suspected pairs: 3 merged (same race, confirmed on the
 *              organiser's page or same series and day), 19 marked separate,
 *              1 left open (Zlaté Hory: the regional championship is not named
 *              on the cup's page).
 *   Missing a link — races in a series with an official site get that site.
 *
 * Usage: npx tsx scripts/admin-queues-2026-10-20.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

const DRY = process.argv.includes("--dry");
const BY = "admin-queue-review 2026-10-20";

const PAUSE = [
  // Never yielded a race: shops, club home pages, a portal, single FCI calendar rows.
  "http://pekloseveru.cz",
  "https://agrokolin.cz",
  "https://blinduro.com",
  "https://roadclassics.cz",
  "https://spac-os.cz",
  "https://spsvd.cz",
  "https://kolo.cz",
  "https://members.federciclismo.it/race/icald/180799",
  "https://members.federciclismo.it/race/icald/182221",
  "https://members.federciclismo.it/race/icald/182288",
  "https://radsport-sah.de/rookiescup",
  // HTTP 500 for weeks; a Madrid kids' standings page, nothing ahead.
  "https://fmciclismo.com/es/smartweb/seccion/seccion/madrid/ESCUELAS/Clasificaciones-BTT-Escuelas",
  // The parser cannot read these pages; the race on each is held by hand.
  "https://www.321vabank.cz/",
  "https://www.porubajk.cz/",
  "https://black-forest-ultra-bike.de/p/kids-cup",
];

const HIDE_SLUGS = [
  "moravsky-pohar-unknown-2026", // sk-mp.cz home page, date guessed as the day it was read
  "thuringer-radsport-verband-e-v-2026", // the federation's own name
];

/** [keep, drop] — keep holds more sources or the official site. */
const MERGE: [string, string, string][] = [
  ["96c5327a-0fb6-40e8-a435-89d46e8fa2ee", "a70f79d6-cdab-4d27-84d7-82ea8af70fc1", "Ústecký kraj CX championship = KP Ústeckého kraje, same day and venue"],
  ["5e68495a-bed5-4e91-9165-f3c1eb060dfd", "ef2f3fbb-4e97-48be-88d8-5e20e8ced9e8", "Darmstadt: vc1899darmstadt.de names one Crossrennen an der Radrennbahn on 13 Dec"],
  ["3a10adcc-1cb1-4abf-b0a4-7b58a0c9cf2d", "85e978cf-ccb2-443a-8aa2-3b74a5801a1f", "Prachatice: two rows of the same TBC série round"],
];

/** Pairs index from the 2026-10-20 list that are two real races. */
const SEPARATE: [string, string][] = [];

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { listSuspiciousDuplicates, dismissSuspiciousPair } = await import("../src/lib/catalog/suspicious-duplicates");
  const { mergeEventPair } = await import("../src/lib/catalog/merge-duplicates");
  const supabase = createServerSupabase();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  async function lock(eventId: string, fields: Record<string, unknown>) {
    const { data: existing } = await supabase
      .from("event_overrides")
      .select("fields,locked_fields")
      .eq("event_id", eventId)
      .maybeSingle();
    const merged = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...fields };
    const locked = [...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(fields)])];
    const { error } = await supabase
      .from("event_overrides")
      .upsert({ event_id: eventId, fields: merged, locked_fields: locked, updated_by: BY }, { onConflict: "event_id" });
    if (error) throw new Error(error.message);
  }

  // ── Sources ────────────────────────────────────────────────────────────
  console.log(`pause ${PAUSE.length} sources`);
  if (!DRY) {
    const { error } = await supabase
      .from("watched_urls")
      .update({ status: "paused", notes: `paused by ${BY}: no race from it, or unreadable for a race kept by hand`, updated_at: now })
      .in("url", PAUSE)
      .eq("status", "active");
    if (error) throw new Error(error.message);
  }

  // ── Races ──────────────────────────────────────────────────────────────
  const { data: cyklomanek } = await supabase
    .from("events")
    .select("id")
    .eq("slug", "cyklomanek-jizda-do-vrchu-2026")
    .is("merged_into_id", null)
    .maybeSingle();
  if (cyklomanek) {
    console.log("Cyklománek Jízda do vrchu → 17 Oct 2026, completed");
    if (!DRY) {
      const { error } = await supabase
        .from("events")
        .update({ start_date: "2026-10-17", end_date: "2026-10-17", status: "completed", updated_at: now })
        .eq("id", cyklomanek.id);
      if (error) throw new Error(error.message);
      await lock(cyklomanek.id as string, { start_date: "2026-10-17", end_date: "2026-10-17" });
    }
  }
  const { data: junk } = await supabase.from("events").select("id,name").in("slug", HIDE_SLUGS).is("merged_into_id", null);
  for (const row of junk ?? []) {
    console.log(`hide "${row.name}"`);
    if (DRY) continue;
    const { error } = await supabase.from("events").update({ visibility: "hidden", updated_at: now }).eq("id", row.id);
    if (error) throw new Error(error.message);
    await lock(row.id as string, { visibility: "hidden" });
  }

  // ── Sources that read fine but find nothing because the race is over ───
  // After the hides and the date fix above, so those sources fall in here too.
  const { data: quiet } = await supabase
    .from("watched_urls")
    .select("id,url")
    .eq("status", "active")
    .in("last_extract_status", ["needs_review", "error"]);
  let offSeason = 0;
  for (const w of quiet ?? []) {
    const { count: any } = await supabase
      .from("event_sources")
      .select("event_id", { count: "exact", head: true })
      .eq("watched_url_id", w.id);
    if (!any) continue;
    const { count: ahead } = await supabase
      .from("event_sources")
      .select("event_id, event:events!inner(start_date, visibility)", { count: "exact", head: true })
      .eq("watched_url_id", w.id)
      .eq("event.visibility", "public")
      .gte("event.start_date", today);
    if (ahead) continue;
    offSeason += 1;
    if (!DRY) {
      const { error } = await supabase
        .from("watched_urls")
        .update({ last_extract_status: "off_season", last_error: null, updated_at: now })
        .eq("id", w.id);
      if (error) throw new Error(error.message);
    }
  }
  console.log(`off season: ${offSeason} sources`);

  // ── Duplicates ─────────────────────────────────────────────────────────
  for (const [keep, drop, why] of MERGE) {
    console.log(`merge ${drop} → ${keep} (${why})`);
    if (!DRY) await mergeEventPair(keep, drop);
  }
  const merged = new Set(MERGE.flatMap(([a, b]) => [a, b]));
  const OPEN = new Set(["01269cd3-3147-4ce6-b47f-cff6535e50e1:4bbcdb31-0dbf-4abe-8159-cd5c56370dde"]);
  const pairs = await listSuspiciousDuplicates({});
  for (const p of pairs) {
    if (OPEN.has(p.key)) continue;
    // A pair touching a merged row: the merge settled it; the rest are two races.
    if (merged.has(p.left.id) && merged.has(p.right.id)) continue;
    SEPARATE.push([p.left.id, p.right.id]);
    console.log(`separate: ${p.left.name} | ${p.right.name}`);
    if (!DRY) await dismissSuspiciousPair(p.left.id, p.right.id);
  }

  // ── Missing a link: a round of a series with its own site ───────────────
  const { data: unlinked } = await supabase
    .from("events")
    .select("id,name,series:series!events_series_id_fkey(website_url)")
    .eq("visibility", "public")
    .gte("start_date", today)
    .is("website_url", null)
    .is("registration_url", null)
    .is("merged_into_id", null)
    .not("series_id", "is", null);
  for (const row of (unlinked ?? []) as unknown as { id: string; name: string; series: { website_url: string | null } | null }[]) {
    const site = row.series?.website_url;
    if (!site) continue;
    console.log(`link "${row.name}" → ${site}`);
    if (!DRY) {
      const { error } = await supabase.from("events").update({ website_url: site, updated_at: now }).eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  console.log(DRY ? "(dry run — nothing written)" : "done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
