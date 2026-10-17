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
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { previewUrl } from "../src/lib/watcher/run";
import { sourceEditionIsRepresented, sourceEditionExists, type StoredEdition } from "../src/lib/catalog/source-yield";
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
const KINDS = (process.argv.find(a => a.startsWith("--kinds="))?.slice(8) ?? "series,federation,aggregator,calendar").split(",");
const COUNTRIES = new Set((process.env.CATALOG_COUNTRIES ?? "CZ,SK,AT,DE,PL,CH").split(","));
const OUT = process.argv.find(a => a.startsWith("--out="))?.slice(6);

async function main() {
  const supabase = createServerSupabase();
  const { data: sources, error } = await supabase
    .from("watched_urls")
    .select("id,url,kind,last_extract_status")
    .eq("status", "active")
    .in("kind", KINDS).order("kind").order("id");
  if (error) throw new Error(error.message);

  const rows = (sources ?? []).slice(0, LIMIT);
  console.log(`checking ${rows.length} active calendar sources\n`);

  const checked = await mapPool(rows, 4, async (s) => {
    // Counts across different years hide omissions. Compare source IDs and the complete stored edition date range.
    const stored: StoredEdition[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("event_sources").select("external_id,events!inner(start_date,end_date,visibility,merged_into_id)").eq("watched_url_id", s.id).order("id").range(from, from + 999);
      if (error) throw error;
      for (const row of data ?? []) {
        const event = row.events as unknown as Omit<StoredEdition, "externalId">;
        stored.push({ externalId: row.external_id, ...event });
      }
      if (!data || data.length < 1000) break;
    }
    try {
      const preview = await previewUrl(s.url as string);
      if (!preview.ok) return { url: s.url as string, kind: s.kind as string, stored: stored.length, offered: 0, matched: 0, notPublic: [], missing: [], note: (preview as { error?: string }).error ?? "error" };
      const upcoming = [...new Map(preview.events.filter(e => e.startDate >= new Date().toISOString().slice(0, 10) && (!e.countryHint || COUNTRIES.has(e.countryHint))).map(e => [`${e.externalId}|${e.startDate}`, e])).values()];
      const unmatched = upcoming.filter(e => !sourceEditionIsRepresented(stored, e.externalId, e.startDate)).map(e => ({ name: e.name, date: e.startDate, externalId: e.externalId, sourceUrl: e.sourceUrl, countryHint: e.countryHint }));
      const notPublic = unmatched.filter(e => sourceEditionExists(stored, e.externalId, e.date));
      const missing = unmatched.filter(e => !sourceEditionExists(stored, e.externalId, e.date));
      console.log(`CHECKED ${s.url}: public=${upcoming.length - unmatched.length} not-public=${notPublic.length} unrepresented=${missing.length}`);
      return { url: s.url as string, kind: s.kind as string, stored: stored.length, offered: upcoming.length, matched: upcoming.length - unmatched.length, notPublic, missing, note: "" };
    } catch (error) { return { url: s.url as string, kind: s.kind as string, stored: stored.length, offered: 0, matched: 0, notPublic: [], missing: [], note: String(error instanceof Error ? error.message : error).slice(0, 100) }; }
  });

  // A source offering materially more than it has delivered is truncating.
  const short = checked
    .filter((c) => c.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length);

  console.log(`SHORT — offering more than the catalogue holds: ${short.length}`);
  for (const c of short) {
    console.log(
      `   offers ${String(c.offered).padStart(4)}  holds ${String(c.matched).padStart(4)}  ` +
        `(-${String(c.missing.length).padStart(4)})  ${c.url.slice(0, 62)}`,
    );
  }

  const errored = checked.filter((c) => c.note);
  console.log(`\nunreachable or erroring: ${errored.length}`);
  errored
    .slice(0, 12)
    .forEach((c) => console.log(`   ${c.note.slice(0, 24).padEnd(26)} ${c.url.slice(0, 60)}`));

  const totalOffered = checked.reduce((n, c) => n + c.offered, 0);
  const totalStored = checked.reduce((n, c) => n + c.matched, 0);
  const totalNotPublic = checked.reduce((n, c) => n + c.notPublic.length, 0);
  console.log(`\nupcoming offered ${totalOffered} · public ${totalStored} · not public ${totalNotPublic} · unrepresented ${totalOffered - totalStored - totalNotPublic}`);
  if (OUT) writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), checked }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
