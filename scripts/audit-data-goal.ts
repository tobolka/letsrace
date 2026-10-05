/** Read-only: completeness, missing fields and shared series documents. */
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { ACTIVE_EVENT_STATUSES } = await import("../src/lib/event-visibility");
  const { isAggregatorUrl } = await import("../src/lib/watcher/public-url");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  type E = { id: string; name: string; start_date: string; age_categories: string[] | null; age_confidence: string | null; disciplines: string[] | null; website_url: string | null; regulations_url: string | null; series_id: string | null; location: { lat: number | null; lng: number | null; country_code: string | null } | null; series: { name: string; age_categories_confirmed_at: string | null } | null };
  const events: E[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s.from("events")
      .select("id,name,start_date,age_categories,age_confidence,disciplines,website_url,regulations_url,series_id,location:locations(lat,lng,country_code),series:series!events_series_id_fkey(name,age_categories_confirmed_at)")
      .eq("visibility", "public").is("merged_into_id", null).in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today).lte("start_date", new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10))
      .order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    events.push(...((data ?? []) as unknown as E[]));
    if (!data || data.length < 1000) break;
  }
  const missing = (e: E) => [
    !e.website_url || isAggregatorUrl(e.website_url) ? "ownWebsite" : null,
    !e.regulations_url ? "regulations" : null,
    e.location?.lat == null || e.location.lng == null ? "location" : null,
    !e.disciplines?.length ? "discipline" : null,
    !e.age_categories?.length || e.age_confidence !== "explicit" ? "categories" : null,
  ].filter((v): v is string => Boolean(v));
  const bySeries = new Map<string, E[]>();
  for (const e of events) if (e.series_id) {
    const key = `${e.series_id}:${e.start_date.slice(0, 4)}`;
    bySeries.set(key, [...(bySeries.get(key) ?? []), e]);
  }
  const series = [...bySeries].map(([key, rows]) => ({
    key, name: rows[0]!.series?.name, confirmed: Boolean(rows[0]!.series?.age_categories_confirmed_at), rounds: rows.length,
    missingCategories: rows.filter((e) => missing(e).includes("categories")).length,
    statedSets: [...new Set(rows.filter((e) => e.age_confidence === "explicit").map((e) => [...(e.age_categories ?? [])].sort().join(",")))],
    sharedRules: [...new Set(rows.map((e) => e.regulations_url).filter(Boolean))],
    exampleIds: rows.slice(0, 3).map((e) => e.id),
  })).filter((s) => s.missingCategories).sort((a, b) => b.missingCategories - a.missingCategories);
  const report = { auditedAt: new Date().toISOString(), total: events.length,
    completeWithOwnWebsite: events.filter((e) => !missing(e).length).length,
    missing: Object.fromEntries(["ownWebsite", "regulations", "location", "discipline", "categories"].map((f) => [f, events.filter((e) => missing(e).includes(f)).length])),
    seriesPriority: series,
    websiteExamples: events.filter((e) => missing(e).includes("ownWebsite")).slice(0, 12).map((e) => ({ id: e.id, name: e.name, date: e.start_date, country: e.location?.country_code })),
  };
  writeFileSync("tmp/data-goal-audit-2026-10-05.json", JSON.stringify(report, null, 2) + "\n");
  console.log({ total: report.total, completeWithOwnWebsite: report.completeWithOwnWebsite, missing: report.missing, seriesToReview: series.length });
  console.table(series.slice(0, 12).map(({ name, rounds, missingCategories, statedSets }) => ({ name, rounds, missingCategories, statedSets: statedSets.length })));
  console.log(report.websiteExamples.slice(0, 3));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
