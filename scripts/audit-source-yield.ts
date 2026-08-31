/**
 * Is each source actually landing everything it offers?
 *
 * A source can look healthy — read on schedule, no errors — while delivering a
 * fraction of its calendar. radsport-events.de did exactly that: 640 races
 * behind a paginated API, a hardcoded six-page cap, and 300 of them silently
 * never seen. Nothing reported it, because from the outside a partial read and
 * a complete one are the same event.
 *
 * Asks each source what it returns now and compares that against what the
 * catalogue holds from it.
 *
 * Usage: nvm use 22 && npx tsx scripts/audit-source-yield.ts [--limit 80]
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

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 90;

async function main() {
  const supabase = createServerSupabase();
  const { data: sources, error } = await supabase
    .from("watched_urls")
    .select("id,url,kind,last_extract_status")
    .eq("status", "active")
    .in("kind", ["series", "federation", "aggregator", "calendar"]);
  if (error) throw new Error(error.message);

  const rows = (sources ?? []).slice(0, LIMIT);
  console.log(`checking ${rows.length} active calendar sources\n`);

  const checked = await mapPool(rows, 4, async (s) => {
    // What the catalogue holds from this source.
    const { count } = await supabase
      .from("event_sources")
      .select("*", { count: "exact", head: true })
      .eq("watched_url_id", s.id);

    let offered = 0;
    let note = "";
    try {
      const preview = await previewUrl(s.url as string);
      if (preview.ok) offered = preview.events.length;
      else note = (preview as { error?: string }).error ?? "error";
    } catch (e) {
      note = String(e instanceof Error ? e.message : e).slice(0, 30);
    }
    return { url: s.url as string, kind: s.kind as string, stored: count ?? 0, offered, note };
  });

  // A source offering materially more than it has delivered is truncating.
  const short = checked
    .filter((c) => c.offered > 0 && c.offered > c.stored + 5 && c.offered > c.stored * 1.25)
    .sort((a, b) => b.offered - b.stored - (a.offered - a.stored));

  console.log(`SHORT — offering more than the catalogue holds: ${short.length}`);
  for (const c of short) {
    console.log(
      `   offers ${String(c.offered).padStart(4)}  holds ${String(c.stored).padStart(4)}  ` +
        `(-${String(c.offered - c.stored).padStart(4)})  ${c.url.slice(0, 62)}`,
    );
  }

  const errored = checked.filter((c) => c.note);
  console.log(`\nunreachable or erroring: ${errored.length}`);
  errored
    .slice(0, 12)
    .forEach((c) => console.log(`   ${c.note.slice(0, 24).padEnd(26)} ${c.url.slice(0, 60)}`));

  const totalOffered = checked.reduce((n, c) => n + c.offered, 0);
  const totalStored = checked.reduce((n, c) => n + c.stored, 0);
  console.log(`\noffered ${totalOffered} · held ${totalStored}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
