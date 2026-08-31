/**
 * Which watched sources are silently not delivering?
 *
 * A source can sit `active` for weeks while its recorded state says
 * `off_season`, `error` or `needs_review` — and still return a full calendar
 * when asked. The Czech federation portal was doing exactly that: 369 races
 * available, 43% of the official September–October calendar missing from the
 * catalogue, and nothing in the admin health view pointed at it.
 *
 * Compares what each source yields right now against what its row claims.
 *
 * Usage: nvm use 22 && npx tsx scripts/audit-stuck-sources.ts [--all]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl } from "../src/lib/watcher/run";
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

const ALL = process.argv.includes("--all");
const SUSPECT = ["off_season", "error", "needs_review", "null"];

async function main() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("watched_urls")
    .select("id,url,kind,status,last_extract_status,last_error,last_fetched_at")
    .eq("status", "active")
    .in("kind", ["series", "federation", "aggregator", "calendar"]);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter(
    (r) => ALL || SUSPECT.includes(String(r.last_extract_status)),
  );
  console.log(`checking ${rows.length} active calendar sources${ALL ? " (all)" : " (suspect state only)"}`);

  const checked = await mapPool(rows, 4, async (r) => {
    try {
      const p = await previewUrl(r.url as string);
      if (!p.ok) return { r, n: 0, note: (p as { error?: string }).error ?? "error" };
      const upcoming = p.events.filter(
        (e) => e.startDate >= new Date().toISOString().slice(0, 10),
      ).length;
      return { r, n: p.events.length, upcoming, note: p.strategy ?? "-" };
    } catch (e) {
      return { r, n: 0, note: String(e instanceof Error ? e.message : e).slice(0, 40) };
    }
  });

  // Yielding races while its row says otherwise — the catalogue is missing them.
  const stuck = checked
    .filter((c) => c.n > 0 && SUSPECT.includes(String(c.r.last_extract_status)))
    .sort((a, b) => b.n - a.n);
  const genuinelyEmpty = checked.filter((c) => c.n === 0);

  console.log(`\nSTUCK — returning races while marked otherwise: ${stuck.length}`);
  stuck.forEach((c) =>
    console.log(
      `   ${String(c.n).padStart(4)} races (${c.upcoming ?? 0} upcoming)  marked=${String(c.r.last_extract_status).padEnd(12)} ` +
        `seen=${c.r.last_fetched_at ? String(c.r.last_fetched_at).slice(0, 10) : "never"}  ${String(c.r.url).slice(0, 62)}`,
    ),
  );
  console.log(`\nempty or unreachable (probably correct): ${genuinelyEmpty.length}`);
  genuinelyEmpty
    .slice(0, 15)
    .forEach((c) => console.log(`   ${String(c.note).slice(0, 26).padEnd(28)} ${String(c.r.url).slice(0, 62)}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
