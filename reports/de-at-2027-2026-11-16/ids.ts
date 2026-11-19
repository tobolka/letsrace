import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
const args = process.argv.slice(2);
const { data, error } = await db.from("events").select("id,slug,name,start_date,end_date,status,visibility,disciplines,formats,age_categories,age_confidence,audience,event_type,competition_type,level,registration_url,regulations_url,website_url,merged_into_id,source_kind,location_id,location:locations(id,venue,municipality,country_code,region)").in("id", args);
if (error) throw error;
for (const e of data!) { console.log(JSON.stringify(e)); const { data: ov } = await db.from("event_overrides").select("locked_fields").eq("event_id", e.id).maybeSingle(); if (ov) console.log("   locked:", ov.locked_fields); }
}
main();
