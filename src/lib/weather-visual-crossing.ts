import { climateFrom, CLIMATE_WINDOW, RACE_HOURS, type Climate, type Forecast, type ForecastHour, type Sky } from "@/lib/weather";

type Day = { datetime?: string; tempmax?: number; tempmin?: number; temp?: number; precip?: number; precipprob?: number; windspeed?: number; windgust?: number; winddir?: number; cloudcover?: number; icon?: string; sunrise?: string; sunset?: string; hours?: Day[] };
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const tenth = (v: number) => Math.round(v * 10) / 10;

async function timeline(lat: number, lng: number, from: string, to?: string, hours = false, deadline = Date.now() + 8000) {
  const q = new URLSearchParams({ unitGroup: "metric", include: hours ? "days,hours" : "days", contentType: "json", elements: hours
    ? "datetime,tempmax,tempmin,temp,precip,precipprob,windspeed,windgust,winddir,icon,cloudcover,sunrise,sunset"
    : "datetime,tempmax,tempmin,precip" });
  // Anonymous access: no account, card or billable key. Fair-use 429s are respected.
  const res = await fetch(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat.toFixed(2)},${lng.toFixed(2)}/${from}${to ? `/${to}` : ""}?${q}`, {
    headers: { "Accept-Encoding": "gzip", Accept: "application/json" },
    signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))),
  });
  if (!res.ok) throw new Error(`visual_crossing_http_${res.status}`);
  const json = await res.json() as { days?: Day[] };
  if (!Array.isArray(json.days)) throw new Error("visual_crossing_invalid_days");
  return json.days;
}

function sky(day: Day): Sky {
  if (day.icon?.includes("snow")) return "snow";
  if (day.icon?.includes("thunder")) return "storm";
  if (day.icon?.includes("rain")) return "rain";
  if (day.icon?.includes("fog")) return "fog";
  if (day.icon?.startsWith("clear")) return "clear";
  if (day.icon?.startsWith("partly")) return "partly";
  return finite(day.cloudcover) && day.cloudcover < 20 ? "clear" : "cloudy";
}

export function visualCrossingForecast(day: Day, date: string): Forecast | null {
  if (day.datetime !== date || ![day.tempmax, day.tempmin, day.precip, day.windspeed].every(finite)) return null;
  const hours = (day.hours ?? []).flatMap((row): ForecastHour[] => {
    if (!row.datetime || !/^\d{2}:00:00$/.test(row.datetime)) return [];
    const hour = Number(row.datetime.slice(0, 2));
    if (!RACE_HOURS.includes(hour) || ![row.temp, row.precip, row.windspeed, row.windgust, row.winddir].every(finite)) return [];
    return [{ hour, temp: Math.round(row.temp!), rainMm: tenth(row.precip!), rainChance: finite(row.precipprob) ? row.precipprob : null,
      windKmh: Math.round(row.windspeed!), gustKmh: Math.round(row.windgust!), windFrom: Math.round(row.winddir!), sky: sky(row),
      day: Boolean(day.sunrise && day.sunset && row.datetime >= day.sunrise && row.datetime < day.sunset) }];
  });
  return { tmax: Math.round(day.tempmax!), tmin: Math.round(day.tempmin!), rainMm: tenth(day.precip!),
    rainChance: finite(day.precipprob) ? day.precipprob : null, windKmh: Math.round(day.windspeed!), sky: sky(day), hours, source: "visual-crossing" };
}

export async function visualCrossingForecastFor(lat: number, lng: number, date: string) {
  const days = await timeline(lat, lng, date, undefined, true);
  return days.length === 1 ? visualCrossingForecast(days[0], date) : null;
}

/** Ten seven-day windows, not ten entire years. Bounded to two concurrent reads. */
export async function visualCrossingHistory(lat: number, lng: number, dates: string[], today: string): Promise<Record<string, Climate>> {
  const last = Number(today.slice(0, 4)) - 1;
  const deadline = Date.now() + 22_000;
  const result: Record<string, Climate> = {};
  // Cap this fallback at one requested period per location/batch (70 daily records).
  // Other periods remain absent and are picked up on the next scheduled pass.
  const date = dates[0];
  const md = date.slice(5) === "02-29" ? "02-28" : date.slice(5);
  const collected = new Map<string, Day>();
  for (let y = last - 9; y <= last; y += 2) {
    if (Date.now() >= deadline) throw new Error("visual_crossing_history_deadline");
    const batch = await Promise.all([y, y + 1].map(async year => {
      const day = Date.parse(`${year}-${md}T00:00:00Z`);
      const from = new Date(day - CLIMATE_WINDOW * 86400_000).toISOString().slice(0, 10);
      const to = new Date(day + CLIMATE_WINDOW * 86400_000).toISOString().slice(0, 10);
      return timeline(lat, lng, from, to, false, deadline);
    }));
    for (const rows of batch) for (const row of rows) if (row.datetime) collected.set(row.datetime, row);
  }
  const rows = [...collected.values()].sort((a, b) => a.datetime!.localeCompare(b.datetime!));
  const climate = climateFrom(rows.map(d => d.datetime!), rows.map(d => finite(d.tempmax) ? d.tempmax : null),
    rows.map(d => finite(d.tempmin) ? d.tempmin : null), rows.map(d => finite(d.precip) ? d.precip : null), date,
    { firstYear: last - 9, lastYear: last, fullWindow: true });
  if (!climate || climate.years !== 10) throw new Error("visual_crossing_history_incomplete");
  result[date.slice(5)] = { ...climate, source: "visual-crossing", referenceYear: last };
  return result;
}
