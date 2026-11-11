/**
 * Regulations links the Mac's readers put into the copy here (calendar rows, rad-net, the Polish
 * and Italian federations, search) go to the server as proposals, through the same gate as the
 * queue lane and the agent, instead of being carried over by local-sync. Every one of them gets
 * a history row with the words it rests on, which three of those readers never left.
 *
 *   tsx scripts/pipeline2-local-regulations.ts [--apply] [--max=60]
 *
 * This process holds the server access and reads the document only to quote it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { documentIsAboutRace } from "../src/lib/catalog/race-completeness";
import { readDocument } from "../src/lib/catalog/regulation-ages";

const BIN = process.env.LOCAL_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const local = <T>(query: string): T => JSON.parse(execFileSync(`${BIN}/psql`, ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", "letsrace", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8", maxBuffer: 2 ** 28 }).trim() || "null");
const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const READERS = /^(?:site_documents|calendar_row|search_verified|practical_details|series_document|watcher_update_v2|agent)$/;

async function main() {
  const apply = process.argv.includes("--apply"), max = Number(arg("max") ?? 60);
  type Held = { id: string; url: string; name: string; start_date: string; municipality: string | null; method: string | null; version: string | null; source_url: string | null; quote: string | null };
  const filled = local<Held[]>(`select coalesce(json_agg(t),'[]') from (
    select e.id, e.regulations_url url, e.name, e.start_date, l.municipality, f.method, f.version, f.source_url, f.quote
    from public.events e left join public.locations l on l.id=e.location_id left join lateral (select method, version, source_url, quote from public.event_facts x where x.event_id=e.id and x.field='regulations_url' and x.status='active' and x.value #>> '{}' = e.regulations_url order by x.created_at desc limit 1) f on true
    where e.regulations_url ~ '^https?://' and e.visibility='public' and e.merged_into_id is null and e.start_date>=current_date order by e.start_date) t`);
  for (const [key, value] of Object.entries(parse(readFileSync(resolve(__dirname, "..", ".env.local"), "utf8")))) process.env[key] ??= value;
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();
  const call = (name: string, params: object) => (db as unknown as { rpc(name: string, params: object): PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(name, params);
  // Only races the server holds with the field still empty are of interest.
  const empty = new Set<string>();
  for (let i = 0; i < filled.length; i += 200) {
    const { data, error } = await db.from("events").select("id").in("id", filled.slice(i, i + 200).map(row => row.id)).is("regulations_url", null).eq("visibility", "public").is("merged_into_id", null);
    if (error) throw Error(error.message);
    for (const row of data ?? []) empty.add(row.id);
  }
  const todo = filled.filter(row => empty.has(row.id)).slice(0, max);
  const totals: Record<string, number> = {}; const add = (key: string) => { totals[key] = (totals[key] ?? 0) + 1; };
  for (const row of todo) {
    // Whatever reader put the link here, the document itself must be about this race in this year.
    // Last year's regulations on an unchanged address, and a club newsletter, both got through before this (11 Nov 2026).
    const text = (await readDocument(row.url, { maxBytes: 8 * 1024 * 1024 }).catch(() => null))?.text ?? "";
    if (text.replace(/\s+/g, " ").trim().length < 8) { add("held_unreadable_document"); continue; }
    if (!documentIsAboutRace(text, { name: row.name, start_date: row.start_date, municipality: row.municipality })) { add("held_not_clearly_this_race_and_year"); continue; }
    const quote = row.quote && row.quote.trim().length >= 8 ? row.quote : text.replace(/\s+/g, " ").trim().slice(0, 300);
    const reader = row.method && READERS.test(row.method) ? row.method : "federation_page";
    if (!apply) { add(`would_propose_${reader}`); continue; }
    const submitted = await call("pipeline_submit_proposal", { p_event: row.id, p_field: "regulations_url", p_value: row.url, p_source: row.source_url && /^https?:\/\//.test(row.source_url) ? row.source_url : row.url, p_quote: quote.slice(0, 500), p_reader: reader, p_version: row.version ?? "1", p_task: "local_copy" });
    if (submitted.error) throw Error(submitted.error.message);
    const decided = await call("pipeline_apply_proposal", { p_key: submitted.data as string });
    if (decided.error) throw Error(decided.error.message);
    const decision = decided.data as { status: string; reason: string | null };
    add(`${decision.status}${decision.reason ? `_${decision.reason}` : ""}`);
  }
  console.log("local_regulations " + JSON.stringify({ apply, filledHere: filled.length, emptyOnServer: empty.size, considered: todo.length, ...totals }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
