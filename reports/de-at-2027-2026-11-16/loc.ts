import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
for (const p of process.argv.slice(2)) { const { data } = await db.from("locations").select("id,venue,municipality,region,country_code,lat,lng").ilike("municipality", `%${p}%`).limit(12); console.log("##",p); for (const l of data??[]) console.log(JSON.stringify(l)); }
const { data } = await db.from("events").select("id,name,start_date,visibility,merged_into_id").ilike("name","%SuperGiro%").gte("start_date","2027-01-01"); console.log(JSON.stringify(data));
}
main();
