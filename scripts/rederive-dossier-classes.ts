/**
 * Re-read the classes the dossier reader stored, from the lines it kept, with
 * the current rules. No model. A list that no longer holds is put back to what
 * the race had before; a changed one is updated.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/rederive-dossier-classes.ts [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

async function main() {
  const apply = process.argv.includes("--apply");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { bandsFromLines, listLike, statable } = await import("../src/lib/catalog/dossier-classes");
  const { audienceFromAgeCategories } = await import("../src/lib/taxonomy");
  const s = createServerSupabase();
  const { data } = await s.from("event_facts").select("id, event_id, value, previous, quote, source_url, events!inner(name, start_date, age_categories)").eq("version", "dossier-classes-v1").eq("field", "age_categories").eq("status", "active");
  const tally = { facts: 0, same: 0, changed: 0, undone: 0 };
  for (const f of (data ?? []) as unknown as { id: string; event_id: string; value: string[]; previous: string[] | null; quote: string | null; source_url: string | null; events: { name: string; start_date: string; age_categories: string[] | null } }[]) {
    tally.facts += 1;
    if (JSON.stringify(f.events.age_categories) !== JSON.stringify(f.value)) continue;
    const lines = (f.quote ?? "").split(" | ").map((line) => ({ line, url: f.source_url ?? "" })).filter((l) => listLike(l.line, l.url));
    const { ages } = bandsFromLines(lines, f.events.start_date);
    const ok = statable({ name: f.events.name }, { ages, lines });
    if (ok && JSON.stringify(ages) === JSON.stringify(f.value)) { tally.same += 1; continue; }
    if (ok) {
      tally.changed += 1;
      console.log(`${apply ? "SET " : "DRY "} ${f.events.name}: ${f.value.join(",")} → ${ages.join(",")}`);
      if (apply) {
        await s.from("events").update({ age_categories: ages, audience: audienceFromAgeCategories(ages), updated_at: new Date().toISOString() }).eq("id", f.event_id);
        await s.from("event_facts").update({ value: ages }).eq("id", f.id);
      }
    } else {
      tally.undone += 1;
      console.log(`${apply ? "UNDO" : "DRY "} ${f.events.name}: ${f.value.join(",")} → back to ${(f.previous ?? []).join(",") || "-"}`);
      if (apply) {
        await s.from("events").update({ age_categories: f.previous ?? [], age_confidence: (f.previous ?? []).length ? "default" : null, updated_at: new Date().toISOString() }).eq("id", f.event_id);
        await s.from("event_facts").update({ status: "rolled_back" }).eq("event_id", f.event_id).eq("version", "dossier-classes-v1");
      }
    }
  }
  console.log(tally);
}
main().catch((e) => { console.error(e); process.exit(1); });
