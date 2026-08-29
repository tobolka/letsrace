/**
 * Clear links that are not the race's own page.
 *
 * Three kinds accumulated, all of which render as a working button on the card
 * and send the rider somewhere useless:
 *
 *  - sign-in forms and newsletter anchors offered as "Register" (iXS Downhill
 *    Cup rounds pointed at /en/login, Austrian races at #newsletter-anmeldung);
 *  - a single organiser's propozice PDF stamped across every race on a calendar
 *    page — one Slovak club's document was attached to six unrelated races, and
 *    a triathlon site to a seventh;
 *  - aggregator and federation calendars presented as the race website.
 *
 * A missing link is honest; a wrong one is not, and the map already treats
 * "no link" as a known state.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/clean-bad-links.ts --dry
 *   nvm use 22 && npx tsx scripts/clean-bad-links.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { isAccountOrNewsletterUrl } from "../src/lib/watcher/registration-url";
import { hostOf } from "../src/lib/watcher/public-url";

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
const LINK_FIELDS = ["website_url", "registration_url", "regulations_url", "results_url"] as const;

type Row = {
  id: string;
  name: string;
  start_date: string;
  visibility: string | null;
  website_url: string | null;
  registration_url: string | null;
  regulations_url: string | null;
  results_url: string | null;
  series_id: string | null;
  overrides: { locked_fields?: string[] }[] | null;
};

/**
 * Hosts whose shared documents are legitimate.
 *
 * A federation publishes one propozice PDF per round under its own calendar, and
 * a timing provider one results page per series — those *should* repeat across
 * the rounds. Only a random organiser's document showing up on unrelated races
 * is a bleed.
 */
const SHARED_DOC_OK =
  /cyklistikaszc\.sk|czechcyclingfederation\.com|ceskysvazcyklistiky\.cz|cyclingaustria\.at|swiss-cycling\.ch|federciclismo\.it|uci\.org|uec\.ch|rad-net\.de|sportsoft\.cz|raceresult|sportchallenge|datasport|mtbiker\.sk/i;

/** Distinct enough that one shared link cannot be all of their own pages. */
function namesAreDistinct(rows: Row[]): boolean {
  const keys = new Set(
    rows.map((r) => r.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)),
  );
  return keys.size >= 3;
}

async function main() {
  const supabase = createServerSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id,name,start_date,visibility,series_id,website_url,registration_url,regulations_url,results_url," +
          "overrides:event_overrides(locked_fields)",
      )
      .order("start_date")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const patches = new Map<string, Record<string, null>>();
  const stats = { account: 0, bleed: 0 };
  const queue = (row: Row, field: string, why: keyof typeof stats) => {
    const locked = new Set(row.overrides?.[0]?.locked_fields ?? []);
    if (locked.has(field)) return;
    const patch = patches.get(row.id) ?? {};
    if (field in patch) return;
    patch[field] = null;
    patches.set(row.id, patch);
    stats[why] += 1;
  };

  for (const row of rows) {
    for (const field of LINK_FIELDS) {
      const url = row[field];
      if (!url) continue;
      if (isAccountOrNewsletterUrl(url)) queue(row, field, "account");
    }
  }

  /**
   * A document belongs to a series, so the same rulebook on every round of one
   * cup is correct — `cup.cube.eu/rennen/reglement` really is the reglement for
   * all twelve CUBE Cup rounds. It is only a bleed when one organiser's document
   * has been stamped across races from *different* series: a Volyně triathlon's
   * propozice was attached to 31 unrelated races, from West Bohemia Tour to
   * L'Étape Slovakia.
   */
  for (const field of ["regulations_url", "results_url"] as const) {
    const byUrl = new Map<string, Row[]>();
    for (const row of rows) {
      const url = row[field];
      if (!url) continue;
      const list = byUrl.get(url) ?? [];
      list.push(row);
      byUrl.set(url, list);
    }
    for (const [url, group] of byUrl) {
      if (group.length < 3 || !namesAreDistinct(group)) continue;
      if (SHARED_DOC_OK.test(url)) continue;
      // Only real series ids count. Treating each unlinked row as its own series
      // made every series rulebook look like it spanned a dozen of them.
      const seriesIds = new Set(group.map((r) => r.series_id).filter(Boolean));
      if (seriesIds.size < 3) continue;
      // The decisive check: a series' own rulebook lives on the series' own host,
      // so it matches either a race name or one of the group's websites. A
      // stranger's document matches nothing.
      const host = (hostOf(url) ?? "").replace(/\.[a-z]{2,3}$/, "").replace(/[^a-z0-9]/g, "");
      const belongs = group.some(
        (r) =>
          host.includes(r.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)) ||
          hostOf(r.website_url) === hostOf(url),
      );
      if (belongs) continue;
      for (const row of group) queue(row, field, "bleed");
    }
  }

  console.log(`${patches.size} řádků k úpravě${DRY ? " (dry run)" : ""}`, stats);
  const sample = [...patches.entries()].slice(0, 15);
  for (const [id, patch] of sample) {
    const row = rows.find((r) => r.id === id)!;
    console.log(`   ${row.start_date} ${row.name.slice(0, 44).padEnd(46)} maže: ${Object.keys(patch).join(", ")}`);
  }
  if (DRY) return;

  // Write the old values out before touching anything: clearing a link is cheap
  // to undo from this file, and impossible to undo without it.
  const backup = [...patches.entries()].map(([id, patch]) => {
    const row = rows.find((r) => r.id === id)!;
    return {
      id,
      name: row.name,
      cleared: Object.fromEntries(
        Object.keys(patch).map((f) => [f, row[f as (typeof LINK_FIELDS)[number]]]),
      ),
    };
  });
  const backupPath = `link-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 1));
  console.log(`záloha původních odkazů: ${backupPath}`);

  let updated = 0;
  for (const [id, patch] of patches) {
    const { error } = await supabase
      .from("events")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error(`  ! ${id}: ${error.message}`);
    else updated += 1;
  }
  console.log({ updated });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
