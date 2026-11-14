/**
 * Carry out catalogue fixes someone has read and decided, from a file, so the decision and its
 * reason stay on record and the same tool serves the next review.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/apply-reviewed-fixes.ts --file=reports/.../fixes.json [--apply]
 *
 * The file holds three lists. Every entry names the race as it was read ("name" must still be
 * the start of the race's name), so a record that changed since the review is left alone.
 *   merges: { keep, drop, name, why }             the same race twice; "drop" folds into "keep"
 *   holds:  { id, name, why }                     a date nobody announced; hidden as "tbc" and locked
 *   dates:  { id, name, start_date?, end_date, why }  the organiser's stated days
 * Dry run by default. Merges go through the same database routine as every other merge, so
 * scripts/restore-event-merge.ts undoes one.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

type Merge = { keep: string; drop: string; name: string; why: string };
type Hold = { id: string; name: string; why: string };
type Dates = { id: string; name: string; start_date?: string; end_date: string; why: string };
type Row = { id: string; name: string; start_date: string; end_date: string | null; status: string; visibility: string; merged_into_id: string | null };

async function main() {
  const file = process.argv.find(arg => arg.startsWith("--file="))?.slice(7);
  if (!file) throw new Error("--file=fixes.json is required");
  const apply = process.argv.includes("--apply");
  const fixes = JSON.parse(readFileSync(file, "utf8")) as { merges?: Merge[]; holds?: Hold[]; dates?: Dates[] };
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { mergeEventPair } = await import("../src/lib/catalog/merge-duplicates");
  const db = createServerSupabase();
  const ids = [...new Set([...(fixes.merges ?? []).flatMap(m => [m.keep, m.drop]), ...(fixes.holds ?? []).map(h => h.id), ...(fixes.dates ?? []).map(d => d.id)])];
  const { data, error } = await db.from("events").select("id,name,start_date,end_date,status,visibility,merged_into_id").in("id", ids).returns<Row[]>();
  if (error) throw new Error(error.message);
  const rows = new Map((data ?? []).map(row => [row.id, row]));
  const asRead = (id: string, name: string) => {
    const row = rows.get(id);
    if (!row) return "not found";
    if (row.merged_into_id) return "already merged";
    return row.name.startsWith(name) ? null : `name is now "${row.name}"`;
  };
  const result = { merged: 0, held: 0, dated: 0, skipped: [] as string[], failed: [] as string[] };
  const skip = (what: string, reason: string) => { result.skipped.push(`${what}: ${reason}`); };

  for (const merge of fixes.merges ?? []) {
    const keep = rows.get(merge.keep), problem = asRead(merge.drop, merge.name) ?? (!keep ? "kept race not found" : keep.merged_into_id ? "kept race is itself merged" : null);
    if (problem) { skip(`merge ${merge.name}`, problem); continue; }
    console.log(`${apply ? "MERGE" : "DRY merge"} ${rows.get(merge.drop)!.start_date} "${rows.get(merge.drop)!.name}" → ${keep!.start_date} "${keep!.name}" (${merge.why})`);
    if (!apply) continue;
    try { await mergeEventPair(merge.keep, merge.drop); result.merged++; }
    catch (e) { result.failed.push(`merge ${merge.name}: ${e instanceof Error ? e.message : e}`); }
  }
  for (const hold of fixes.holds ?? []) {
    const problem = asRead(hold.id, hold.name);
    const row = rows.get(hold.id);
    if (problem ?? (row!.visibility === "hidden" ? "already hidden" : null)) { skip(`hold ${hold.name}`, problem ?? "already hidden"); continue; }
    console.log(`${apply ? "HOLD" : "DRY hold"} ${row!.start_date} "${row!.name}" ${row!.status}/${row!.visibility} → tbc/hidden (${hold.why})`);
    if (!apply) continue;
    const now = new Date().toISOString();
    const updated = await db.from("events").update({ status: "tbc", visibility: "hidden", updated_at: now }).eq("id", hold.id);
    // The lock keeps a reader from putting the estimate back; it is lifted when a date is announced.
    const locked = updated.error ? updated : await db.from("event_overrides").upsert({ event_id: hold.id, fields: { status: "tbc", visibility: "hidden" }, locked_fields: ["status", "visibility"], updated_by: "reviewed-fixes", updated_at: now }, { onConflict: "event_id" });
    if (locked.error) result.failed.push(`hold ${hold.name}: ${locked.error.message}`); else result.held++;
  }
  for (const change of fixes.dates ?? []) {
    const problem = asRead(change.id, change.name);
    const row = rows.get(change.id);
    const start = change.start_date ?? row?.start_date;
    if (problem ?? (!/^\d{4}-\d{2}-\d{2}$/.test(change.end_date) || !start || change.end_date < start ? "invalid dates" : row!.start_date === start && row!.end_date === change.end_date ? "already so" : null)) { skip(`dates ${change.name}`, problem ?? "invalid or unchanged"); continue; }
    console.log(`${apply ? "DATES" : "DRY dates"} "${row!.name}" ${row!.start_date}..${row!.end_date ?? ""} → ${start}..${change.end_date} (${change.why})`);
    if (!apply) continue;
    const updated = await db.from("events").update({ start_date: start, end_date: change.end_date, updated_at: new Date().toISOString() }).eq("id", change.id);
    if (updated.error) result.failed.push(`dates ${change.name}: ${updated.error.message}`); else result.dated++;
  }
  console.log(`reviewed_fixes ${JSON.stringify({ apply, ...result })}`);
  if (result.failed.length) process.exitCode = 1;
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
