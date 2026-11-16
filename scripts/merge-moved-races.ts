/**
 * Races Cycling Austria moved to another day: fold the old-day race into the new-day one.
 *
 * Reads the federation's whole calendar once (every page, end proven), compares it with the
 * races holding `oerv-<federation id>-<date>` keys, and merges only an old-day race whose
 * federation id is now listed on exactly one other day under the same name, through the
 * normal audited merge (undo with scripts/restore-event-merge.ts). See
 * src/lib/catalog/dated-id-moves.ts for every condition.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/merge-moved-races.ts            # dry run
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/merge-moved-races.ts --apply [--out=file.json]
 *
 * Exit 2 when the calendar could not be read in full: nothing is merged then.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

type SourceRow = {
  external_id: string | null;
  event: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    visibility: string;
    status: string | null;
    merged_into_id: string | null;
    overrides: { locked_fields: string[] | null }[] | { locked_fields: string[] | null } | null;
  } | null;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6);
  const { planDateMoves, readOervCalendar, splitDatedKey, OERV_ID } = await import("../src/lib/catalog/dated-id-moves");
  const { fetchPage } = await import("../src/lib/watcher/http");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { mergeEventPair } = await import("../src/lib/catalog/merge-duplicates");

  const read = await readOervCalendar(async (url) => {
    const got = await fetchPage(url, { fresh: true, timeoutMs: 30_000, retries: 2 });
    return { status: got.status, html: got.html };
  });
  if (!read.complete) {
    console.log(JSON.stringify({ complete: false, reason: read.reason, pages: read.pages, merged: 0 }));
    process.exit(2);
  }

  const supabase = createServerSupabase();
  const rows: SourceRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("event_sources")
      .select("external_id, event:events(id,name,start_date,end_date,visibility,status,merged_into_id,overrides:event_overrides(locked_fields))")
      .like("external_id", "oerv-%")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Reading Cycling Austria sources: ${error.message}`);
    rows.push(...((data ?? []) as unknown as SourceRow[]));
    if (!data || data.length < 1000) break;
  }

  type HeldRace = Parameters<typeof planDateMoves>[1][number];
  const races = new Map<string, HeldRace>();
  for (const row of rows) {
    const ev = Array.isArray(row.event) ? row.event[0] : row.event;
    const key = splitDatedKey(row.external_id, "oerv", OERV_ID);
    if (!ev || !key || ev.merged_into_id) continue;
    const overrides = Array.isArray(ev.overrides) ? ev.overrides[0] : ev.overrides;
    const race: HeldRace = races.get(ev.id) ?? {
      eventId: ev.id,
      name: ev.name,
      startDate: ev.start_date,
      endDate: ev.end_date,
      visibility: ev.visibility,
      status: ev.status,
      lockedFields: overrides?.locked_fields ?? [],
      keys: [],
    };
    if (!race.keys.some((k) => k.id === key.id && k.date === key.date)) race.keys.push(key);
    races.set(ev.id, race);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { moves, heldBack } = planDateMoves(read.entries, [...races.values()], today);
  const merged: typeof moves = [];
  const failed: (typeof moves[number] & { error: string })[] = [];
  if (apply) {
    for (const move of moves) {
      try {
        await mergeEventPair(move.keepId, move.dropId);
        merged.push(move);
      } catch (e) {
        failed.push({ ...move, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const report = {
    complete: true,
    dry: !apply,
    pages: read.pages,
    listed: read.entries.length,
    racesWithIds: races.size,
    moves,
    merged: merged.length,
    failed,
    heldBack,
  };
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
  for (const m of moves) console.log(`${apply ? (merged.includes(m) ? "MERGED" : "FAILED") : "WOULD MERGE"} ${m.dropName} ${m.oldDate} → ${m.newDate} (drop ${m.dropId}, keep ${m.keepId})`);
  for (const h of heldBack) console.log(`HELD ${h.reason}: ${h.name} ${h.oldDate} (${h.eventId})${h.detail ? ` — ${h.detail}` : ""}`);
  console.log(JSON.stringify({ complete: true, dry: !apply, pages: read.pages, listed: read.entries.length, moves: moves.length, merged: merged.length, failed: failed.length, heldBack: heldBack.length }));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
