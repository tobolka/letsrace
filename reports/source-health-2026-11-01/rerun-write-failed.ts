import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
process.env.PIPELINE_REVIEW_QUEUE = "1";
import { createServerSupabase } from "../../src/lib/supabase/server";
import { watchOne } from "../../src/lib/watcher/run";
(async () => {
  const db = createServerSupabase();
  const { data } = await db.from("watched_urls").select("id,url,kind,last_extract_status,last_error").eq("status", "active").eq("last_extract_status", "needs_review").like("last_error", "write_failed%");
  const out: unknown[] = [];
  for (const r of data ?? []) {
    if (r.last_error?.includes("csc-1695")) continue;
    try {
      const o = await watchOne({ ...r, etag: null, last_modified: null, content_hash: null }, { deadline: Date.now() + 200_000 });
      out.push({ url: r.url, ok: o.ok, created: o.eventsCreated, updated: o.eventsUpdated, failed: o.eventsFailed, deferred: o.eventsDeferred, issues: (o.issues ?? []).slice(0, 3) });
    } catch (e) { out.push({ url: r.url, error: String(e).slice(0, 200) }); }
  }
  writeFileSync("reports/source-health-2026-11-01/rerun-write-failed.json", JSON.stringify(out, null, 1));
  console.log("done", out.length);
})();
