import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../../src/lib/supabase/server";
(async () => {
  const db = createServerSupabase();
  for (const s of ["active", "paused", "dead", "pending", "ignored"]) {
    const { count } = await db.from("watched_urls").select("id", { count: "exact", head: true }).eq("status", s);
    console.log(s, count);
  }
  const { data } = await db.from("watched_urls").select("url,status,notes,last_error").eq("status", "paused").limit(4);
  console.log(JSON.stringify(data));
})();
