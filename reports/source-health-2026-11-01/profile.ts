import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const rows = JSON.parse(readFileSync("reports/source-health-2026-11-01/attention-before.json", "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const out: unknown[] = [];
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    const { data, error } = await db.from("event_sources").select("watched_url_id,event:events(id,start_date,status)").in("watched_url_id", chunk.map((r: any) => r.id));
    if (error) throw new Error(error.message);
    for (const r of chunk) {
      const evs = (data ?? []).filter((d: any) => d.watched_url_id === r.id).map((d: any) => Array.isArray(d.event) ? d.event[0] : d.event).filter(Boolean);
      out.push({ ...r, events: evs.length, upcoming: evs.filter((e: any) => e.start_date >= today).length, future2027: evs.filter((e: any) => e.start_date >= "2027-01-01").length });
    }
  }
  writeFileSync("reports/source-health-2026-11-01/attention-profile.json", JSON.stringify(out, null, 1));
})();
