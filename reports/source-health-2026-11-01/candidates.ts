import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const { data, error } = await db.from("pipeline_candidates").select("*").in("status", ["pending", "waiting", "conflict", "publishing"]);
  if (error) throw new Error(error.message);
  writeFileSync("reports/source-health-2026-11-01/candidates-before.json", JSON.stringify(data, null, 1));
  console.log(data?.length, Object.keys(data?.[0] ?? {}).join(","));
})();
