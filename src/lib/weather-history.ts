import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { historicalSummaries, type Climate } from "@/lib/weather";
import { PUBLIC_COUNTRY_CODES } from "@/lib/geo/europe";
import { readAllRows } from "@/lib/supabase/read-all";

export type HistoryTarget = { lat: number; lng: number; dates: string[] };
export const weatherCell = (n: number) => Math.round(n * 100);

export async function readWeatherHistory(lat: number, lng: number, date: string) {
  const db = createServerSupabase() as unknown as SupabaseClient;
  const { data, error } = await db.rpc("weather_history_read", { p_lat: weatherCell(lat), p_lng: weatherCell(lng), p_day: date.slice(5) });
  if (error) throw new Error(error.message);
  return data as { climate: Climate; updatedAt: string; referenceYear: number } | null;
}

/** Rounded cells share a single archive read across races and annual editions. */
export function historyTargets(rows: { start_date: string; location: { lat: number | null; lng: number | null } | null }[]): HistoryTarget[] {
  const groups = new Map<string, HistoryTarget>();
  for (const row of rows) {
    const at = row.location;
    if (at?.lat == null || at.lng == null) continue;
    const lat = weatherCell(at.lat) / 100, lng = weatherCell(at.lng) / 100;
    const key = `${lat},${lng}`;
    const group = groups.get(key) ?? { lat, lng, dates: [] };
    if (!group.dates.some(d => d.slice(5) === row.start_date.slice(5))) group.dates.push(row.start_date);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** A daily shared reservation cap includes failures and crashes. Never erases a good snapshot. */
/**
 * `limit` places per pass: the nightly cron takes what fits in its minute; the
 * backfill script passes a large limit and a long deadline to fill the catalogue.
 */
export async function warmWeatherHistory(today: string, deadline = Date.now() + 45_000, limit = 60) {
  const db = createServerSupabase() as unknown as SupabaseClient;
  const rows: Parameters<typeof historyTargets>[0] = [];
  // Page explicitly: the REST row limit must not silently discard later races.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("events").select("start_date,location:locations!inner(lat,lng)")
      .eq("visibility", "public").is("merged_into_id", null).not("status", "in", "(cancelled,postponed)")
      .in("location.country_code", [...PUBLIC_COUNTRY_CODES])
      .gte("start_date", today).lte("start_date", `${Number(today.slice(0, 4)) + 1}-12-31`)
      .order("start_date").order("id").range(offset, offset + 499);
    if (error) throw new Error(error.message);
    rows.push(...data as unknown as typeof rows);
    if (data.length < 500) break;
    if (Date.now() >= deadline) throw new Error("weather_catalogue_read_deadline");
  }
  const targets = historyTargets(rows);
  const year = Number(today.slice(0, 4)) - 1;
  const snapshots = await readAllRows<{ lat_cell: number; lng_cell: number; reference_year: number | null; summaries: Record<string, Climate> }>(
    (from, to) => db.from("weather_history").select("lat_cell,lng_cell,reference_year,summaries").order("lat_cell").order("lng_cell").range(from, to), { throwOnError: true });
  const cache = new Map(snapshots.map(row => [`${row.lat_cell},${row.lng_cell}`, row]));
  const todo = targets.map(target => {
    const held = cache.get(`${weatherCell(target.lat)},${weatherCell(target.lng)}`);
    return { ...target, dates: target.dates.filter(date => {
      const value = held?.summaries[date.slice(5)];
      return !value || (value.referenceYear ?? held?.reference_year ?? 0) < year;
    }) };
  }).filter(target => target.dates.length);
  const result = { locations: targets.length, pendingPeriods: todo.reduce((n, t) => n + t.dates.length, 0), claimed: 0, updated: 0, failed: 0, deferred: 0 };
  for (const target of todo) {
    if (Date.now() > deadline - 29_000 || result.claimed >= limit) { result.deferred++; continue; }
    const args = { p_lat: weatherCell(target.lat), p_lng: weatherCell(target.lng) };
    const { data: token, error } = await db.rpc("weather_history_claim", { ...args, p_year: year, p_days: target.dates.map(d => d.slice(5)) });
    if (error) throw new Error(error.message);
    if (!token) { result.deferred++; continue; }
    result.claimed++;
    const { data: held, error: heldError } = await db.from("weather_history").select("summaries,reference_year").eq("lat_cell", args.p_lat).eq("lng_cell", args.p_lng).single();
    if (heldError) throw new Error(heldError.message);
    const stored = held.summaries as Record<string, Climate>;
    const dates = target.dates.filter(d => !stored[d.slice(5)] || (stored[d.slice(5)].referenceYear ?? held.reference_year ?? 0) < year);
    let summaries: Record<string, Climate> | null = null, problem: string | null = null;
    try { summaries = await historicalSummaries(target.lat, target.lng, dates, today); }
    catch (error) { problem = error instanceof Error ? error.message : "archive_failed"; }
    const saved = await db.rpc("weather_history_finish", { ...args, p_token: token, p_year: year, p_summaries: summaries, p_error: problem });
    if (saved.error) throw new Error(saved.error.message);
    if (saved.data && !problem) { result.updated++; result.pendingPeriods -= Object.keys(summaries!).length; } else result.failed++;
    // Stop the batch on provider-wide failure; do not hit another eleven places.
    if (problem && (/(?:weather_provider|visual_crossing)_http_(429|5\d\d)/.test(problem))) {
      result.deferred += todo.length - todo.indexOf(target) - 1;
      break;
    }
  }
  return result;
}
