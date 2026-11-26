/**
 * Changes of a date or a cancellation the Mac found, with the words they stand on, sent to the server through the gate.
 *
 *   tsx scripts/pipeline2-date-proposals.ts [--apply] [--max=10] [--in=date-proposals-latest.json] [--out=file.json]
 *
 * The list comes from scripts/date-proposals.cjs: races whose date or cancellation has a quote from a named page. Here
 * each quote is looked up on its page once more, because a page can change after it was read. Whatever still stands
 * goes in as a proposal, and pipeline_apply_proposal decides under the race's manual locks, today's date, a year's
 * limit on a move and the wording a cancellation needs. Dry unless --apply. Set LETSRACE_DATE_PROPOSALS=0 to stop it.
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "dotenv";

export type Proof = { quote: string; source_url: string; method: string };
export type Ready = { id: string; name: string; before: Record<string, string | null>; after: Record<string, string>; proofs: Record<string, Proof> };
export type ServerEventState = { id: string; start_date: string | null; end_date: string | null; status: string | null };
export type PlannedProposal = { item: Ready; columns: string[] };

/** A later start needs the end moved first, an earlier start moves first: the end never comes before the start. */
export function orderColumns(item: Pick<Ready, "before" | "after">): string[] {
  const columns = Object.keys(item.after);
  if (columns.length < 2 || !item.after.start_date || !item.before.start_date) return columns;
  const later = item.after.start_date > item.before.start_date;
  return [...columns].sort((a, b) => (a === "end_date" ? (later ? -1 : 1) : b === "end_date" ? (later ? 1 : -1) : 0));
}

export function serverFieldValue(row: ServerEventState | undefined, column: string): string | null {
  if (!row) return null;
  const raw = column === "start_date" ? row.start_date : column === "end_date" ? row.end_date : column === "status" ? row.status : null;
  if (raw == null) return null;
  return column === "status" ? String(raw) : String(raw).slice(0, 10);
}

/** Skip columns that already match the server before fetching pages or counting toward `max`. */
export function partitionServerMatches(
  ready: Ready[],
  serverById: Map<string, ServerEventState>,
): { todo: PlannedProposal[]; skipped: Array<{ race: string; column: string; to: string }> } {
  const todo: PlannedProposal[] = [];
  const skipped: Array<{ race: string; column: string; to: string }> = [];
  for (const item of ready) {
    const serverRow = serverById.get(item.id);
    const pendingColumns: string[] = [];
    for (const column of orderColumns(item)) {
      const value = item.after[column];
      if (value != null && serverFieldValue(serverRow, column) === value) {
        skipped.push({ race: item.name, column, to: value });
      } else {
        pendingColumns.push(column);
      }
    }
    if (pendingColumns.length > 0) todo.push({ item, columns: pendingColumns });
  }
  return { todo, skipped };
}

async function main() {
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  if (process.env.LETSRACE_DATE_PROPOSALS === "0") { console.log("date_send " + JSON.stringify({ off: true })); return; }
  const apply = process.argv.includes("--apply"), max = Number(arg("max") ?? 10);
  const input = arg("in") ?? join(homedir(), "Library/Application Support/LetsRace/data/date-proposals-latest.json");
  const ready = (JSON.parse(readFileSync(input, "utf8")).ready_all ?? []) as Ready[];
  try { for (const [key, value] of Object.entries(parse(readFileSync(resolve(__dirname, "..", ".env.local"), "utf8")))) process.env[key] ??= value; } catch { /* the runner provides them */ }
  const { readDocument } = await import("../src/lib/catalog/regulation-ages");
  const { quoteIsOn } = await import("../src/lib/catalog/quote-on-page");
  const { quoteStatesDate } = await import("../src/lib/catalog/quoted-date");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const call = (name: string, params: object) => (db as unknown as { rpc(name: string, params: object): PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(name, params);
  const serverById = new Map<string, ServerEventState>();
  const ids = [...new Set(ready.map(item => item.id))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("events").select("id, start_date, end_date, status").in("id", ids.slice(i, i + 200));
    if (error) throw Error(error.message);
    for (const row of (data ?? []) as ServerEventState[]) serverById.set(row.id, row);
  }
  const { todo, skipped } = partitionServerMatches(ready, serverById);
  const totals: Record<string, number> = {}, log: object[] = [];
  const count = (key: string) => { totals[key] = (totals[key] ?? 0) + 1; };
  for (const entry of skipped) {
    count("already_matches_server");
    log.push({ race: entry.race, column: entry.column, to: entry.to, outcome: "already_matches_server" });
  }
  const pages = new Map<string, string>();
  const batch = todo.slice(0, max);
  for (const { item, columns } of batch) {
    for (const column of columns) {
      const proof = item.proofs?.[column], value = item.after[column];
      if (!proof || !value) { count("no_proof"); continue; }
      if (!pages.has(proof.source_url)) pages.set(proof.source_url, (await readDocument(proof.source_url, { maxBytes: 4 * 1024 * 1024 }).catch(() => null))?.text ?? "");
      const text = pages.get(proof.source_url)!;
      if (!quoteIsOn(text, proof.quote)) { count("quote_not_on_page_now"); log.push({ race: item.name, column, outcome: "quote_not_on_page_now" }); continue; }
      if (column !== "status" && !quoteStatesDate(proof.quote, value, { role: column === "end_date" ? "end" : "start" })) { count("quote_does_not_state_the_date"); log.push({ race: item.name, column, outcome: "quote_does_not_state_the_date" }); continue; }
      if (!apply) { count("would_propose_" + column); continue; }
      const submitted = await call("pipeline_submit_proposal", { p_event: item.id, p_field: column, p_value: value, p_source: proof.source_url, p_quote: proof.quote.replace(/\s+/g, " ").trim().slice(0, 300), p_reader: "mac_date_proposals", p_version: "v1" });
      if (submitted.error) throw Error(submitted.error.message);
      const decided = await call("pipeline_apply_proposal", { p_key: submitted.data as string });
      if (decided.error) throw Error(decided.error.message);
      const decision = decided.data as { status: string; reason: string | null };
      const label = `${decision.status}${decision.reason ? `_${decision.reason}` : ""}`;
      count(label);
      log.push({ race: item.name, column, to: value, outcome: label });
    }
  }
  const summary = { at: new Date().toISOString(), apply, considered: batch.length, ...totals };
  const out = arg("out");
  if (out) { const tmp = `${out}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify({ ...summary, log }, null, 2)); renameSync(tmp, out); }
  console.log("date_send " + JSON.stringify(summary));
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
