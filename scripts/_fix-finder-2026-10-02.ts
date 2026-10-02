/**
 * One-off: undo the finder's wrong picks of 2026-10-02 (news sites and an
 * article taken for a race's own site) and strip a session token from one
 * registration link.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import { createServerSupabase } from "../src/lib/supabase/server";

async function main() {
  const supabase = createServerSupabase();
  for (const bad of ["pedaletricolore.it", "radiocorsaweb.it", "gregi.net/clanky"]) {
    const { data } = await supabase.from("events").update({ website_url: null }).ilike("website_url", `%${bad}%`).select("name");
    console.log(bad, data?.length ?? 0, (data ?? []).map((d) => d.name).join(" | "));
  }
  const { data: ev } = await supabase.from("events").select("id, registration_url").ilike("registration_url", "%(X(1)S(%");
  for (const e of ev ?? []) {
    const clean = e.registration_url.replace(/\/\(X\(\d\)S\([^)]*\)\)\//, "/").replace(/[?&]AspxAutoDetectCookieSupport=1/, "");
    await supabase.from("events").update({ registration_url: clean }).eq("id", e.id);
    console.log("cleaned", clean);
  }
}
main();
