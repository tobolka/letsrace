/**
 * Fold empty/junk duplicate series rows and detach Hynek discipline labels.
 * Usage: nvm use 22 && npx tsx scripts/cleanup-series-dupes-2026-09-21.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { attachEventSeries } from "../src/lib/catalog/event-series";

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
const UPDATED_BY = "series-dupe cleanup 2026-09-21";

/** Empty aliases of a canonical series — just hide. */
const EMPTY_DUPES = [
  "cesky-pohar-horskych-kol", // → cesky-pohar-mtb
  "prima-cup", // → primacup
  "ppk-hk", // → pohar-kv-kraje-hk
  "mtb-trilogy", // empty; stages live under mtb-trilogy-enduro / primacup
  "czech-cups-champs",
];

/** Move every primary event to canonical, then hide the alias. */
const FOLD_INTO: Record<string, string> = {
  "cp-cyklo-x": "janev-cup",
  "cp-cyclocross": "janev-cup",
  "fresh-enduro-2026-1": "fresh-enduro-tour",
  // Hynek code `pmtbp` = Pražský MTB pohár (see HYNEK_SERIES)
  pmtbp: "prazsky-mtb-pohar",
};

/**
 * Not a real multi-round cup — detach races (keep them on the map) and hide
 * the series row so it stops cluttering audits / filters.
 */
const DETACH_AND_HIDE = [
  "sport-base", // Jesenický surovec = one race
  "forestovo-zavody",
  "cyclox", // UCI CX worlds mislabeled
  "mcr-xcc",
  "mcr-cyklo-x",
  "szc-mtb-xc", // one youth race, not SP XCO
  "decathlon-cyklomaraton-kids",
  "mtb-trilogy-enduro", // stage debris; race scores in Prima
  "decathlon-cyklomaraton", // one race, not a cup calendar
];

async function seriesId(
  sb: ReturnType<typeof createServerSupabase>,
  slug: string,
): Promise<string | null> {
  const { data } = await sb.from("series").select("id").eq("slug", slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function hideSeries(sb: ReturnType<typeof createServerSupabase>, slug: string) {
  const id = await seriesId(sb, slug);
  if (!id) {
    console.log(`  skip hide (missing): ${slug}`);
    return;
  }
  console.log(`  hide series ${slug}`);
  if (DRY) return;
  await sb.from("series").update({ visibility: "hidden", updated_at: new Date().toISOString() }).eq("id", id);
}

async function primaryEvents(sb: ReturnType<typeof createServerSupabase>, sid: string) {
  const { data } = await sb
    .from("events")
    .select("id, name, start_date")
    .eq("series_id", sid)
    .is("merged_into_id", null);
  return data ?? [];
}

async function main() {
  const sb = createServerSupabase();
  const now = new Date().toISOString();

  console.log(`\n===== empty duplicate series (hide) dry=${DRY}`);
  for (const slug of EMPTY_DUPES) {
    await hideSeries(sb, slug);
  }

  console.log(`\n===== fold into canonical`);
  for (const [fromSlug, toSlug] of Object.entries(FOLD_INTO)) {
    const fromId = await seriesId(sb, fromSlug);
    const toId = await seriesId(sb, toSlug);
    if (!fromId || !toId) {
      console.log(`  skip fold ${fromSlug} → ${toSlug} (missing)`);
      continue;
    }
    const rows = await primaryEvents(sb, fromId);
    console.log(`  ${fromSlug} → ${toSlug} (${rows.length} events)`);
    for (const e of rows) {
      console.log(`    ${e.start_date} ${e.name}`);
      if (DRY) continue;
      await attachEventSeries(sb, e.id as string, toId, { primary: true, source: UPDATED_BY });
    }
    // Drop leftover memberships on the alias
    if (!DRY) {
      await sb.from("event_series").delete().eq("series_id", fromId);
      await sb.from("series").update({ visibility: "hidden", updated_at: now }).eq("id", fromId);
    }
  }

  console.log(`\n===== detach + hide non-series`);
  for (const slug of DETACH_AND_HIDE) {
    const id = await seriesId(sb, slug);
    if (!id) {
      console.log(`  skip detach (missing): ${slug}`);
      continue;
    }
    const rows = await primaryEvents(sb, id);
    console.log(`  ${slug}: detach ${rows.length}`);
    for (const e of rows) {
      console.log(`    ${e.start_date} ${e.name}`);
      if (DRY) continue;
      await sb
        .from("events")
        .update({ series_id: null, updated_at: now })
        .eq("id", e.id);
    }
    if (!DRY) {
      await sb.from("event_series").delete().eq("series_id", id);
      await sb.from("series").update({ visibility: "hidden", updated_at: now }).eq("id", id);
    }
  }

  // Ostravský orphans: events named like the cup with no series
  console.log(`\n===== attach orphan Ostravský MTB pohár rounds`);
  const ostId = await seriesId(sb, "ostravsky-mtb-pohar");
  if (ostId) {
    const { data: orphans } = await sb
      .from("events")
      .select("id, name, start_date")
      .is("series_id", null)
      .is("merged_into_id", null)
      .neq("status", "hidden")
      .gte("start_date", "2026-01-01")
      .lt("start_date", "2027-01-01")
      .or("name.ilike.%Ostravský MTB%,name.ilike.%Ostravsky MTB%,name.ilike.%Memoriál Petra Marka%");
    for (const e of orphans ?? []) {
      // Skip festival / chachar weekend blocks that aren't cup rounds
      if (/hry|chachar|časovka|short track|celkové/i.test(e.name)) continue;
      console.log(`  attach ${e.start_date} ${e.name}`);
      if (DRY) continue;
      await attachEventSeries(sb, e.id as string, ostId, { primary: true, source: UPDATED_BY });
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
