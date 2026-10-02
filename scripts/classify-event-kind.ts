/**
 * Race or ride? A stronger model reads each upcoming listing's name, kind and
 * where it came from, and says whether it is a competition with results, a
 * recreational ride, or something else (a course, a meeting, a run). Rides
 * become event_type 'ride' (kept, not shown as races); the rest is hidden.
 *   LLM_BUDGET_USD=0.6 node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/classify-event-kind.ts [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

const SYSTEM =
  "You sort a cycling calendar. For each numbered listing decide what it is. " +
  "race: a competition with a start list and ranked results — road race, criterium, time trial, MTB/XCO/marathon/enduro/DH race, cyclocross, BMX, track, a timed gran fondo or sportive, an ultra-distance race, a kids' race. " +
  "ride: a recreational or touring event without ranking — výšlap, vyjížďka, cyklovýlet, loučení s létem/zahájení sezóny, RTF, CTF, Radtour, brevet/randonnée, rajd turystyczny, pedalata, cicloturistica, raduno, charity or social ride, slowUp. " +
  "other: not a bike event to enter — a course or training camp, a meeting, an award evening, a run or triathlon, a fair. " +
  "When the name alone does not tell (a plain place name, a cup round), answer race. " +
  'Answer JSON only: {"items":[{"n":1,"kind":"race|ride|other"}]}';

type Row = { id: string; name: string; event_type: string | null; disciplines: string[] | null; website_url: string | null; series: { name: string } | null; sources: { source_url: string | null }[] };

async function main() {
  const apply = process.argv.includes("--apply");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { askJson, SONNET } = await import("../src/lib/llm/anthropic");
  const { recordFacts } = await import("../src/lib/catalog/facts");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  // --since=3: only listings created in the last three days (the daily run).
  const sinceDays = Number(process.argv.find((a) => a.startsWith("--since="))?.slice(8) ?? 0);
  const createdFrom = sinceDays ? new Date(Date.now() - sinceDays * 864e5).toISOString() : "2000-01-01";
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("events").select("id, name, event_type, disciplines, website_url, series:series!events_series_id_fkey(name), sources:event_sources(source_url)")
      .eq("visibility", "public").is("merged_into_id", null).gte("start_date", today).gte("created_at", createdFrom).neq("event_type", "ride").order("id").range(from, from + 999);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  const host = (u: string | null | undefined) => { try { return new URL(u ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } };
  const tally = { listings: rows.length, race: 0, ride: 0, other: 0, cost: 0 };
  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40);
    const user = batch.map((r, k) => `${k + 1}. ${r.name} | type: ${r.event_type ?? "?"} | ${(r.disciplines ?? []).join(",")} | series: ${r.series?.name ?? "-"} | site: ${host(r.website_url)} | listed at: ${[...new Set(r.sources.map((x) => host(x.source_url)))].join(", ")}`).join("\n");
    const { json, usage } = await askJson<{ items?: { n?: number; kind?: string }[] }>({ system: SYSTEM, user, model: SONNET, maxTokens: 1500 });
    tally.cost += usage.costUsd;
    for (const v of json?.items ?? []) {
      const r = typeof v.n === "number" ? batch[v.n - 1] : undefined;
      if (!r || !v.kind) continue;
      if (v.kind === "race") { tally.race += 1; continue; }
      // A festival with races in it stays: its races are what it is listed for.
      if (v.kind === "other" && /festival|festiwal/i.test(r.name)) continue;
      if (v.kind === "ride") tally.ride += 1;
      else if (v.kind === "other") tally.other += 1;
      else continue;
      console.log(`${apply ? "SET" : "DRY"}  ${v.kind.padEnd(5)}  ${r.name}`);
      if (!apply) continue;
      if (v.kind === "ride") {
        await s.from("events").update({ event_type: "ride", updated_at: new Date().toISOString() }).eq("id", r.id);
        await recordFacts(s, r.id, [{ field: "event_type", value: "ride", previous: r.event_type }], { method: "llm", model: SONNET, version: "event-kind-v1" });
      } else {
        await s.from("events").update({ visibility: "hidden", updated_at: new Date().toISOString() }).eq("id", r.id);
        await recordFacts(s, r.id, [{ field: "visibility", value: "hidden", previous: "public" }], { method: "llm", model: SONNET, version: "event-kind-v1" });
      }
    }
  }
  console.log({ ...tally, cost: Number(tally.cost.toFixed(3)), dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });
