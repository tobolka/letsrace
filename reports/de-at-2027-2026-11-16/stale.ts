import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
// Federation rows whose external id names one federation event (oerv-<ID>-<date>) on more than one live race.
const rows: any[] = []; let from = 0;
for (;;) { const { data, error } = await db.from("event_sources").select("event_id,external_id,source_url,created_at,event:events!inner(id,name,start_date,visibility,merged_into_id)").like("external_id","oerv-%").range(from, from+999); if (error) throw error; rows.push(...data!); if (data!.length < 1000) break; from += 1000; }
const byFed = new Map<string, Map<string, any>>();
for (const r of rows) { const m = r.external_id.match(/^oerv-([A-F0-9]+)-(\d{4}-\d{2}-\d{2})$/i); if (!m || r.event.merged_into_id) continue; if (!byFed.has(m[1])) byFed.set(m[1], new Map()); byFed.get(m[1])!.set(r.event.id, { ...r.event, date: m[2], seen: r.created_at }); }
let n = 0;
for (const [fed, evs] of byFed) { if (evs.size < 2) continue; const list = [...evs.values()].filter(e => e.start_date >= "2026-11-16"); if (list.length < 2) continue; n++; console.log(fed, list.map(e => `${e.start_date} ${e.visibility} ${e.id.slice(0,8)} ${e.name.slice(0,40)}`).join("  |  ")); }
console.log("federation events with several live upcoming races:", n);
}
main();
