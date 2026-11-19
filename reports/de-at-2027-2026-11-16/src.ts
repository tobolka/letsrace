import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
for (const id of process.argv.slice(2)) {
  const { data } = await db.from("event_sources").select("*").eq("event_id", id);
  console.log("##", id); for (const s of data ?? []) console.log(JSON.stringify(s).slice(0,500));
  const { data: f } = await db.from("event_facts").select("field,source,created_at").eq("event_id", id).order("created_at").limit(8);
  console.log("  facts:", JSON.stringify(f).slice(0,600));
}}
main();
