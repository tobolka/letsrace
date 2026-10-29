/** Read-only audit of the listing, through the end of next year. */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import { createServerSupabase } from "../src/lib/supabase/server";
import { catalogueWindow, missingOverviewFields, overviewIssues, type OverviewRace } from "../src/lib/catalog/overview-quality";
for (const [key, value] of Object.entries(parse(readFileSync(".env.local")))) process.env[key] ??= value;

async function main() {
  const window = catalogueWindow();
  const db = createServerSupabase();
  type Row = OverviewRace & { id: string; visibility: string };
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("events").select("id,name,start_date,end_date,status,visibility,website_url,disciplines,location:locations(municipality,country_code,lat,lng),sources:event_sources(kind,source_url)")
      .eq("visibility", "public").is("merged_into_id", null).gte("start_date", window.from).lte("start_date", window.until).order("id").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data as Row[]);
    if (data.length < 1000) break;
  }
  const active = rows.filter(e => ["scheduled", "postponed", "registration_open"].includes(e.status ?? ""));
  const groups = new Map<string, Row[]>();
  for (const e of active) {
    const period = e.start_date.slice(0, 4);
    for (const key of [`${period}:ALL`, `${period}:${e.location?.country_code ?? "UNKNOWN"}`]) groups.set(key, [...groups.get(key) ?? [], e]);
  }
  const summary = [...groups].map(([key, events]) => ({ key, total: events.length,
    populatedEssentials: events.filter(e => !missingOverviewFields(e).length).length,
    missing: Object.fromEntries(["name", "date", "place", "country", "discipline", "source"].map(f => [f, events.filter(e => missingOverviewFields(e).includes(f)).length])),
    missingCoordinates: events.filter(e => e.location?.lat == null || e.location?.lng == null).length }));
  const report = { at: new Date().toISOString(), window, definition: "Active public unmerged listings. Populated essentials, not verified accuracy or market coverage; detailed categories and entry links are not required.", summary,
    issues: rows.flatMap(e => { const issues = overviewIssues(e, window.from); return issues.length ? [{ id: e.id, name: e.name, startDate: e.start_date, issues, sources: e.sources }] : []; }),
    missing: active.flatMap(e => { const missing = missingOverviewFields(e); return missing.length ? [{ id: e.id, name: e.name, startDate: e.start_date, country: e.location?.country_code, missing }] : []; }) };
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/catalogue-overview-latest.json", JSON.stringify(report, null, 2));
  console.table(summary.map(({ key, total, populatedEssentials, missingCoordinates }) => ({ key, total, populatedEssentials, missingCoordinates })));
  console.log({ issues: report.issues.length, missingEssentials: report.missing.length, report: "tmp/catalogue-overview-latest.json" });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
