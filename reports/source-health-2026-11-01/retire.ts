import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const rows: { id: string }[] = JSON.parse(readFileSync("reports/source-health-2026-11-01/retire.json", "utf8"));
  const apply = process.argv.includes("--apply");
  let n = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const ids = rows.slice(i, i + 50).map(r => r.id);
    if (!apply) { n += ids.length; continue; }
    const { data, error } = await db.from("watched_urls").update({
      status: "paused", last_extract_status: "off_season",
      notes: "Paused 2026-11-01: results, archive, regulations, document or utility page; yields no races and no catalogue race depends on it. Reactivate only if it becomes a calendar.",
      updated_at: new Date().toISOString(),
    }).in("id", ids).eq("status", "active").in("last_extract_status", ["error", "needs_review"]).select("id");
    if (error) throw new Error(error.message);
    n += data?.length ?? 0;
  }
  console.log(apply ? "paused" : "would pause", n);
})();
