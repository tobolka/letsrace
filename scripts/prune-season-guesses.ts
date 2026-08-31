/**
 * Retire next-season URLs that answer with a different season.
 *
 * `nextSeasonUrl` bumps the year in a path, which is right when the year is the
 * route and wrong when it is decoration. Eighteen mtbs.cz addresses claiming to
 * be 2027 and 2028 calendars all resolve by an article id and return the same
 * 150 races from 2026, so every poll re-imported the current season under a
 * future address — most of why newly added rows were overwhelmingly races that
 * had already happened.
 *
 * Guesses that merely 404 are left alone: those are correctly parked, waiting
 * for the organiser to publish.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/prune-season-guesses.ts --dry
 *   nvm use 22 && npx tsx scripts/prune-season-guesses.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl } from "../src/lib/watcher/run";
import { seasonGuessLanded, yearInPath } from "../src/lib/watcher/core";
import { mapPool } from "../src/lib/watcher/pool";

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

async function main() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("watched_urls")
    .select("id,url,kind,status,last_fetched_at")
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const now = new Date();
  const future = (data ?? []).filter((r) => {
    const y = yearInPath(r.url as string);
    return y != null && y > now.getFullYear();
  });
  console.log(`future-season URLs: ${future.length}`);

  const checked = await mapPool(future, 5, async (r) => {
    try {
      const p = await previewUrl(r.url as string);
      if (!p.ok) return { row: r, verdict: "unreachable" as const, n: 0 };
      const landed = seasonGuessLanded(r.url as string, p.events, now);
      return { row: r, verdict: landed ? ("ok" as const) : ("wrong-season" as const), n: p.events.length };
    } catch {
      return { row: r, verdict: "unreachable" as const, n: 0 };
    }
  });

  const wrong = checked.filter((c) => c.verdict === "wrong-season");
  const ok = checked.filter((c) => c.verdict === "ok");
  const unreachable = checked.filter((c) => c.verdict === "unreachable");
  console.log(`  answering with another season: ${wrong.length}`);
  console.log(`  genuinely next season or still empty: ${ok.length}`);
  console.log(`  unreachable (correctly parked, waiting to be published): ${unreachable.length}`);
  wrong.slice(0, 20).forEach((c) => console.log(`   ✗ ${String(c.row.url).slice(0, 74)} → ${c.n} races, none from its year`));
  if (DRY) return;

  let paused = 0;
  for (const c of wrong) {
    const { error: e } = await supabase
      .from("watched_urls")
      .update({
        status: "paused",
        last_extract_status: "off_season",
        notes: "paused: next-season guess resolves to the current season",
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.row.id);
    if (!e) paused += 1;
  }
  console.log({ paused });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
