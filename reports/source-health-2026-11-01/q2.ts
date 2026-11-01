import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  const show = (t: string, d: unknown) => console.log("##", t, JSON.stringify(d));
  show("WC", (await db.from("events").select("id,name,start_date,end_date,status,visibility").ilike("name", "%World Cup%").gte("start_date", "2026-05-15").lte("start_date", "2026-05-31")).data);
  show("pump", (await db.from("events").select("id,name,start_date,end_date,status,visibility,merged_into_id").ilike("name", "%PUMPTRACK%").gte("start_date", "2026-04-01").lte("start_date", "2026-05-31")).data);
  show("kuncina", (await db.from("events").select("id,name,start_date,status,visibility").ilike("name", "%Kunčin%")).data);
  show("hintersee", (await db.from("events").select("id,name,start_date,status,visibility").ilike("name", "%Hintersee%")).data);
  const c = JSON.parse(readFileSync("reports/source-health-2026-11-01/candidates-before.json", "utf8"));
  for (const x of c) if (/independent_discovery|Provisional|Official website|Aggregator|existing_data/.test(x.reason) || /Kunčina|PUMP/.test(x.payload.name)) console.log("@@", x.id.slice(0, 8), x.payload.name, x.payload.startDate, x.source_url, "|", String(x.reason).slice(0, 260), "|", JSON.stringify(x.payload.evidence ?? {}).slice(0, 300));
  show("sources", (await db.from("pipeline_candidates").select("source_url").eq("payload->>name", "Duatlon Powerman Kunčina")).data);
})();
