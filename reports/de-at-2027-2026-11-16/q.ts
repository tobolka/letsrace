import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
const pats = process.argv.slice(2);
for (const p of pats) {
  const { data, error } = await db.from("events").select("id,slug,name,start_date,end_date,status,visibility,disciplines,formats,registration_url,registration_opens_at,level,audience,competition_type,event_type,website_url,merged_into_id,location:locations(municipality,country_code)").ilike("name", `%${p}%`).gte("start_date","2026-01-01").order("start_date");
  if (error) { console.log(p, error.message); continue; }
  console.log(`## ${p}`);
  for (const e of data ?? []) console.log(JSON.stringify(e));
}

}
main();
