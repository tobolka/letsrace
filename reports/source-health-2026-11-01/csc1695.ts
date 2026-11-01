import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
import { previewUrl } from "../../src/lib/watcher/run";
(async () => {
  const db = createServerSupabase();
  const { data } = await db.from("event_sources").select("external_id,url,event:events(id,name,start_date,end_date,status,city,slug)").eq("external_id", "csc-1695");
  console.log(JSON.stringify(data, null, 1));
  const p = await previewUrl("https://portal.czechcyclingfederation.com/Races/Race/Pub");
  if (p.ok) console.log(JSON.stringify(p.events.filter(e => e.externalId === "csc-1695"), null, 1), p.events.length);
  else console.log(p);
})();
