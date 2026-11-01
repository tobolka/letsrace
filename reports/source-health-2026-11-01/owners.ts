import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const c = JSON.parse(readFileSync("reports/source-health-2026-11-01/candidates-before.json", "utf8"));
  const out: unknown[] = [];
  for (const x of c) {
    const m = String(x.reason).match(/owned by ([0-9a-f-]+)/);
    const d = x.payload?.startDate as string;
    const { data } = await db.from("events").select("id,name,start_date,end_date,status,visibility,slug,disciplines,website_url,merged_into_id,location_id").gte("start_date", d).lte("start_date", d);
    const owner = (data ?? []).filter(e => m ? e.id.startsWith(m[1]!) : true).slice(0, 6);
    out.push({ id: x.id, status: x.status, reason: x.reason, p: x.payload, owner });
  }
  writeFileSync("reports/source-health-2026-11-01/owners.json", JSON.stringify(out, null, 1));
})();
