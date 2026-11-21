/**
 * 2026-11-21: Cyklokros Zábřeh (Oderský pohár final, 28. 11. 2026). The organiser's poster
 * (https://www.facebook.com/MoravskyPoharCyklo) lists starts for "odrážedla 0–6 let",
 * "jízdní kola 6–10 let" and "žáci, žačky"; the record had no children's categories.
 * Usage: npx tsx scripts/fix-zabreh-cx-kids-2026-11-21.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import type { Json } from "../src/lib/supabase/tables";
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const s = createServerSupabase();
const ID = "b9776533-29a1-4b87-918b-d07dd40f54f7";
const SOURCE = "https://www.facebook.com/MoravskyPoharCyklo";
const AGES = ["u7", "u9", "u11", "u13", "u15", "u17", "kids", "youth", "junior", "u23", "elite", "amateur", "masters"];
async function main() {
  const now = new Date().toISOString();
  const { error } = await s.from("events").update({ age_categories: AGES, age_confidence: "explicit", audience: "mixed", updated_at: now }).eq("id", ID);
  if (error) throw new Error(error.message);
  const { data: ex } = await s.from("event_overrides").select("fields,locked_fields").eq("event_id", ID).single();
  await s.from("event_overrides").update({
    fields: { ...(ex!.fields as object), age_categories: AGES } as Json,
    locked_fields: [...new Set([...(ex!.locked_fields as string[]), "age_categories"])],
    updated_by: "zabreh cx kids 2026-11-21",
  }).eq("event_id", ID);
  await s.from("event_sources").insert({ event_id: ID, source_url: SOURCE, kind: "official", is_canonical: true, external_id: "moravskypoharcyklo-fb-2026-11-28" });
  const { error: fe } = await s.from("event_facts").insert({
    event_id: ID, field: "age_categories", value: AGES as unknown as Json, source_url: SOURCE,
    quote: "10:00 ODRÁŽEDLA 0–6 LET, JÍZDNÍ KOLA 6–10 LET; 11:00 ŽÁCI, ŽAČKY, KADETKY …; 12:30 … JUNIOŘI, MUŽI ELITE, MUŽI OPEN, MUŽI DO 23 LET",
    method: "manual_source_review", version: "announced-edition-v1",
  });
  if (fe) throw new Error(fe.message);
  console.log("OK", ID);
}
main().catch((e) => { console.error(e); process.exit(1); });
