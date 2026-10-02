/**
 * Read again, from scratch, the sources no parser could read — now with the
 * language model as the reader of last resort. Also any URL fragment given.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/reread-sources.ts [--status=needs_review,error] [--match=fragment] [--max=80] [--budget=3]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  process.env.LLM_CALENDAR_BUDGET_USD = arg("budget") ?? "3";
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { watchOne } = await import("../src/lib/watcher/run");
  const s = createServerSupabase();
  let q = s.from("watched_urls").select("id, url, kind, last_extract_status").neq("status", "dead").order("url").limit(Number(arg("max") ?? 80));
  const match = arg("match");
  if (match) q = q.ilike("url", `%${match}%`);
  else q = q.in("last_extract_status", (arg("status") ?? "needs_review,error").split(","));
  const { data } = await q;
  let read = 0, written = 0;
  for (const row of data ?? []) {
    const out = await watchOne({ ...row, etag: null, last_modified: null, content_hash: null });
    read += out.eventsExtracted ?? 0;
    written += out.eventsUpserted ?? 0;
    console.log(`${out.ok ? "ok " : "ERR"}  ${String(out.eventsExtracted ?? 0).padStart(3)} read ${String(out.eventsUpserted ?? 0).padStart(3)} written  ${out.strategy ?? ""}  ${row.url}${out.error ? `  ${out.error}` : ""}`);
  }
  console.log({ sources: data?.length ?? 0, read, written });
}
main().catch((e) => { console.error(e); process.exit(1); });
