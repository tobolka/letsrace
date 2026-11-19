import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
for (const h of ["endure-cycling","racedays","rumpelwege","radmarathon.at","racetime","radsport-events","bikeboard","rad-net","cyclingaustria","mtb-news","raceresult","my.raceresult","sportograf","kids-cup","xco-nrw","bw-cup","eventivsport","mtbcup","bikemarathon","radsportkalender","radsport-kalender","bdr","rad-kalender"]) {
  const { data } = await db.from("watched_urls").select("url,status,kind,last_fetched_at,last_extract_status,operational_state").ilike("url", `%${h}%`).limit(400);
  const st: Record<string,number> = {}; for (const r of data??[]) st[r.status]=(st[r.status]??0)+1;
  console.log(h.padEnd(20), (data??[]).length, JSON.stringify(st), (data??[]).slice(0,2).map(r=>r.url).join(" | ").slice(0,160));
}}
main();
