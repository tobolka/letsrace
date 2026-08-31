/**
 * Rebuild `events.fingerprint` from the location each event actually has.
 *
 * The key was written at insert time, before geocoding resolved, so 48% of the
 * catalog carried "nogps" while sitting on perfectly good coordinates. That
 * blinds the geohash half of duplicate detection: four listings of one Czech
 * Cup round at Nové Město could not see each other.
 *
 * Recomputing creates collisions on purpose — two rows that were only distinct
 * because one of them claimed to have no location. Those are the same race, so
 * they are merged before the new keys are written; `events_fingerprint_key`
 * would otherwise reject the update.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/recompute-fingerprints.ts --dry
 *   nvm use 22 && npx tsx scripts/recompute-fingerprints.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { fingerprint } from "../src/lib/domain";

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

const DRY = process.argv.includes("--dry");

type Row = {
  id: string;
  name: string;
  start_date: string;
  visibility: string | null;
  fingerprint: string | null;
  website_url: string | null;
  registration_url: string | null;
  series_id: string | null;
  locations: { lat?: number | null; lng?: number | null } | null;
};

async function main() {
  const supabase = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,name,start_date,visibility,fingerprint,website_url,registration_url,series_id,locations(lat,lng)",
      )
      .order("start_date")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  // Rows already retired by a merge keep their `merged:<id>` marker.
  const live = rows.filter((r) => !r.fingerprint?.startsWith("merged:"));
  const next = new Map<string, string>();
  for (const r of live) {
    next.set(
      r.id,
      fingerprint({
        startDate: r.start_date,
        name: r.name,
        lat: r.locations?.lat ?? null,
        lng: r.locations?.lng ?? null,
      }),
    );
  }

  const changed = live.filter((r) => next.get(r.id) !== r.fingerprint);
  const byNew = new Map<string, Row[]>();
  for (const r of live) {
    const fp = next.get(r.id)!;
    const list = byNew.get(fp) ?? [];
    list.push(r);
    byNew.set(fp, list);
  }
  const collisions = [...byNew.entries()].filter(([, g]) => g.length > 1);

  console.log(`rows ${live.length}, fingerprint changes ${changed.length}${DRY ? " (dry run)" : ""}`);
  console.log(`new collisions to fold first: ${collisions.length} groups, ${collisions.reduce((a, [, g]) => a + g.length - 1, 0)} rows`);
  collisions.slice(0, 12).forEach(([fp, g]) =>
    console.log(`   ${fp.slice(0, 52)}\n      ${g.map((r) => `${r.name.slice(0, 34)} [${r.visibility}]`).join("\n      ")}`),
  );
  if (DRY) return;

  const { collapseFingerprintCollisions } = await import("../src/lib/catalog/merge-duplicates");
  // Keep the richest row in each group; the rest are retired and take a
  // `merged:<id>` key, so they cannot clash with the new fingerprints.
  const retired = new Set<string>();
  for (const [, group] of collisions) {
    const rank = (r: Row) =>
      (r.visibility === "public" ? 1000 : 0) +
      (r.website_url ? 100 : 0) +
      (r.registration_url ? 100 : 0) +
      (r.series_id ? 50 : 0);
    const keep = group.reduce((a, b) => (rank(a) >= rank(b) ? a : b));
    for (const drop of group) if (drop.id !== keep.id) retired.add(drop.id);
  }

  let merged = 0;
  let updated = 0;
  let failed = 0;
  for (const [, group] of collisions) {
    const keep = group.find((r) => !retired.has(r.id))!;
    for (const drop of group) {
      if (drop.id === keep.id) continue;
      const { error } = await supabase
        .from("events")
        .update({
          visibility: "hidden",
          status: "hidden",
          fingerprint: `merged:${drop.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", drop.id);
      if (error) failed += 1;
      else merged += 1;
    }
  }

  for (const r of changed) {
    if (retired.has(r.id)) continue;
    const { error } = await supabase
      .from("events")
      .update({ fingerprint: next.get(r.id), updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      failed += 1;
      console.error(`  ! ${r.name.slice(0, 40)}: ${error.message}`);
    } else {
      updated += 1;
    }
  }
  console.log({ merged, updated, failed });
  void collapseFingerprintCollisions;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
