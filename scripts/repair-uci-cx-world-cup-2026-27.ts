/**
 * Reconcile the 2026/27 CX World Cup with UCI's official date/age schedule.
 * https://www.uci.org/pressrelease/the-uci-decides-to-consult-professional-road-cycling-stakeholders-in-order/2Rtpt5zAFeCMkSREw55k8O
 * Dry by default. Pass --apply after checking the 12 rows and two stale ghosts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

const APPLY = process.argv.includes("--apply");
const ROUND_DATES = [
  "2026-11-27", "2026-11-29", "2026-12-13", "2026-12-19",
  "2026-12-20", "2026-12-26", "2026-12-27", "2026-12-29",
  "2027-01-03", "2027-01-17", "2027-01-23", "2027-01-24",
] as const;
const YOUTH_ROUNDS = new Set(["2026-11-29", "2026-12-20", "2026-12-29", "2027-01-17", "2027-01-24"]);
const GHOSTS = [
  { id: "9616d0eb-96ae-431f-af8f-5effcb68dff6", date: "2026-11-23" },
  { id: "a503b96a-9d67-4ab3-86f4-270404d20cb4", date: "2026-12-07" },
];

async function main() {
  const sb = createServerSupabase();
  const { data: canonical, error: seriesError } = await sb.from("series")
    .select("id,slug").eq("slug", "uci-cx-world-cup").single();
  if (seriesError || !canonical) throw new Error(seriesError?.message ?? "canonical series missing");
  const { data: rounds, error: roundsError } = await sb.from("events")
    .select("id,name,start_date,age_categories,audience,visibility")
    .eq("series_id", canonical.id).gte("start_date", ROUND_DATES[0]).lte("start_date", ROUND_DATES.at(-1)!)
    .is("merged_into_id", null).order("start_date");
  if (roundsError) throw new Error(roundsError.message);
  if (rounds?.length !== 12 || rounds.some((r, i) => r.start_date !== ROUND_DATES[i] || r.visibility !== "public")) {
    throw new Error("Official round count/date/visibility differs from the reviewed 12-row schedule");
  }
  const { data: ghosts, error: ghostsError } = await sb.from("events")
    .select("id,name,start_date,visibility,series_id").in("id", GHOSTS.map((g) => g.id));
  if (ghostsError) throw new Error(ghostsError.message);
  if (ghosts?.length !== 2 || GHOSTS.some((g) => !ghosts.some((r) => r.id === g.id && r.start_date === g.date && r.name === "UCI Cyclo-cross World Cup"))) {
    throw new Error("Stale ghost rows changed; review them again");
  }

  for (const row of rounds) {
    const ages = YOUTH_ROUNDS.has(row.start_date) ? ["junior", "u23", "elite"] : ["elite"];
    console.log(`${row.start_date} ${row.name}: ${JSON.stringify(row.age_categories)} → ${JSON.stringify(ages)}`);
    if (!APPLY) continue;
    const audience = ages.length === 1 ? "adults" : "mixed";
    const { error } = await sb.from("events").update({ age_categories: ages, audience, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) throw new Error(`${row.id}: ${error.message}`);
    const { error: lockError } = await sb.from("event_overrides").upsert({
      event_id: row.id, fields: { age_categories: ages, audience },
      locked_fields: ["age_categories", "audience"], updated_by: "official-uci-2026-27",
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" });
    if (lockError) throw new Error(`${row.id} override: ${lockError.message}`);
  }
  for (const ghost of ghosts) {
    console.log(`${ghost.start_date} ${ghost.name}: ${ghost.visibility} → hidden (old-season date)`);
    if (!APPLY || ghost.visibility === "hidden") continue;
    const { error } = await sb.from("events").update({ visibility: "hidden", updated_at: new Date().toISOString() }).eq("id", ghost.id).eq("visibility", "public");
    if (error) throw new Error(`${ghost.id}: ${error.message}`);
    const { error: lockError } = await sb.from("event_overrides").upsert({
      event_id: ghost.id, fields: { visibility: "hidden" }, locked_fields: ["visibility"],
      updated_by: "official-uci-2026-27", updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" });
    if (lockError) throw new Error(`${ghost.id} override: ${lockError.message}`);
  }
  const { data: duplicateSeries, error: duplicateError } = await sb.from("series")
    .select("id").eq("slug", "uci-cyclox-world-cup").single();
  if (duplicateError || !duplicateSeries) throw new Error(duplicateError?.message ?? "obsolete series missing");
  const { data: staleLinks, error: linkError } = await sb.from("event_series")
    .select("event_id,is_primary,source,event:events(series_id,visibility)")
    .eq("series_id", duplicateSeries.id).eq("is_primary", false);
  if (linkError) throw new Error(linkError.message);
  const reviewedLinks = (staleLinks ?? []).filter((link) => {
    const event = Array.isArray(link.event) ? link.event[0] : link.event;
    return link.source === "watcher" && event?.series_id === canonical.id && event?.visibility === "public";
  });
  console.log(`${reviewedLinks.length} obsolete secondary World Cup links → remove`);
  if (APPLY) {
    for (const link of reviewedLinks) {
      const { error } = await sb.from("event_series").delete()
        .eq("event_id", link.event_id).eq("series_id", duplicateSeries.id)
        .eq("is_primary", false).eq("source", "watcher");
      if (error) throw new Error(`${link.event_id} obsolete membership: ${error.message}`);
    }
  }
  if (APPLY) {
    const { error } = await sb.from("series").update({ visibility: "hidden", updated_at: new Date().toISOString() })
      .eq("slug", "uci-cyclox-world-cup").eq("visibility", "public");
    if (error) throw new Error(`obsolete series: ${error.message}`);
  }
  console.log(APPLY ? "Applied official World Cup reconciliation" : "Dry run only");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
