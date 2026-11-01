import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
import { watchOne } from "../../src/lib/watcher/run";
(async () => {
  const db = createServerSupabase();
  const { data } = await db.from("watched_urls").select("id,url,kind,last_extract_status").eq("id", "3c570c1d-4eaf-495b-ad26-0dc33766ff0a").single();
  const out = await watchOne({ ...data!, etag: null, last_modified: null, content_hash: null }, { deadline: Date.now() + 240_000 });
  console.log(JSON.stringify(out).slice(0, 1500));
  const after = await db.from("watched_urls").select("last_extract_status,last_error").eq("id", data!.id).single();
  console.log(after.data);
  const ev = await db.from("events").select("id,name,start_date,end_date,status,visibility").eq("id", "7ff0bc3f-f5fa-4eaf-ae05-225e37591344").single();
  console.log(ev.data);
})();
