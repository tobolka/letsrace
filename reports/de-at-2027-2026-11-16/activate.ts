import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split("\n")) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.replace(/^["']|["']$/g,""); }
async function main(){
const { createServerSupabase } = await import("../../src/lib/supabase/server");
const db = createServerSupabase();
const { data, error } = await db.from("watched_urls").update({ status: "active", next_poll_at: new Date().toISOString() }).eq("url","https://events.endure-cycling.com/events.json").select("id,status,next_poll_at");
if (error) throw error; console.log(JSON.stringify(data));
}
main();
