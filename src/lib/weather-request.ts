import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

type Provider = "open-meteo" | "visual-crossing";
/** Conservative whole-call accounting for Open-Meteo's variable/time multipliers. */
export function openMeteoUnits(url: string) {
  const q = new URL(url).searchParams;
  const variables = ["daily", "hourly", "current"].flatMap(k => (q.get(k) ?? "").split(",").filter(Boolean)).length;
  const days = q.has("start_date") && q.has("end_date") ? (Date.parse(q.get("end_date")!) - Date.parse(q.get("start_date")!)) / 86400_000 + 1 : 14;
  return Math.ceil(Math.max(1, days / 14) * Math.max(1, variables / 10));
}
export class WeatherDeferred extends Error {
  constructor(reason: "budget" | "deadline", provider?: Provider) { super(`weather_${reason}_deferred${provider ? `:${provider}` : ""}`); }
}

export async function reserveWeatherRequests(provider: Provider, units: number[], deadline: number) {
  if (Date.now() >= deadline) throw new WeatherDeferred("deadline");
  const db = createServerSupabase() as unknown as SupabaseClient;
  const { data, error } = await db.rpc("weather_provider_claim_batch", { p_provider: provider, p_units: units, p_history: true })
    .abortSignal(AbortSignal.timeout(Math.max(1, Math.min(2000, deadline - Date.now()))));
  if (error || !Array.isArray(data) || data.length !== units.length) throw new WeatherDeferred("budget", provider);
  return data as string[];
}

/** Fail closed: no unreserved provider request when the shared ledger is unavailable. */
export async function weatherRequest(provider: Provider, url: string, units: number, deadline: number, maxMs: number, init: RequestInit = {}, history = false, reservedToken?: string) {
  if (Date.now() >= deadline) throw new WeatherDeferred("deadline");
  const db = createServerSupabase() as unknown as SupabaseClient;
  let token = reservedToken;
  if (!token) {
    const { data, error } = await db.rpc("weather_provider_claim", { p_provider: provider, p_units: units, p_history: history })
      .abortSignal(AbortSignal.timeout(Math.max(1, Math.min(2000, deadline - Date.now()))));
    if (error) throw new WeatherDeferred("budget", provider);
    token = data;
  }
  if (!token) throw new WeatherDeferred("budget", provider);
  let status = -1; // Reserved but not sent: a local deadline must not trip a provider circuit.
  try {
    if (Date.now() >= deadline) throw new WeatherDeferred("deadline");
    status = 0;
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.max(1, Math.min(maxMs, deadline - Date.now()))) });
    status = res.status;
    if (!res.ok) throw new Error(`${provider === "open-meteo" ? "weather_provider" : "visual_crossing"}_http_${res.status}`);
    // Reading the body shares the request's abort signal and time limit.
    return await res.json() as Record<string, unknown>;
  } finally {
    try {
      const { error } = await db.rpc("weather_provider_finish", { p_token: token, p_status: status }).abortSignal(AbortSignal.timeout(1000));
      if (error) console.error("weather provider accounting deferred");
    } catch { console.error("weather provider accounting deferred"); }
  }
}
