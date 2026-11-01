import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("watched_urls")
      .select("id,url,kind,status,last_extract_status,last_error,last_fetched_at,notes,added_by,parent_id")
      .eq("status", "active").in("last_extract_status", ["error", "needs_review"])
      .order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  writeFileSync("reports/source-health-2026-11-01/attention-before.json", JSON.stringify(rows, null, 1));
  console.log(rows.length);
})();
