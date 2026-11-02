/**
 * Weather for a race day, from Open-Meteo (CC BY 4.0, no key).
 *
 * Close to the day a forecast is worth showing; months ahead it is noise, so
 * a race further out gets what that day has usually been like over the last
 * ten years instead. Near races get both: the forecast and what is normal.
 */

/** Open-Meteo forecasts sixteen days; the last few are too rough to print. */
export const FORECAST_DAYS = 14;
const CLIMATE_YEARS = 10;
/** Days either side of the date counted as "that time of year". */
export const CLIMATE_WINDOW = 3;

export type Sky = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm";

/** One point of the race day, every two hours from morning to evening. */
export type ForecastHour = {
  hour: number;
  temp: number;
  rainMm: number;
  rainChance: number | null;
  windKmh: number;
  gustKmh: number;
  /** Where the wind blows from, in degrees. */
  windFrom: number;
  sky: Sky;
  day: boolean;
};
export type Forecast = {
  source?: "open-meteo" | "visual-crossing";
  tmax: number;
  tmin: number;
  rainChance: number | null;
  rainMm: number;
  windKmh: number;
  sky: Sky;
  hours: ForecastHour[];
};
/** One past year's week around the race's date. */
export type ClimateYear = { year: number; tmax: number; tmin: number; rainMm: number };
export type Climate = { tmax: number; tmin: number; rainyShare: number; years: number; byYear: ClimateYear[]; source?: "open-meteo" | "visual-crossing"; referenceYear?: number };
export type RaceWeather = { forecast: Forecast | null; climate: Climate | null; forecastFetchedAt?: string | null };

export class WeatherProviderError extends Error {
  constructor(public status: number) { super(`weather_provider_http_${status}`); }
}

/** WMO weather code to the few kinds of sky a rider dresses for. */
export function skyOf(code: number): Sky {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const round = (n: number) => Math.round(n);

async function getJson(url: string, timeoutMs = 12000): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new WeatherProviderError(res.status);
  return (await res.json()) as Record<string, unknown>;
}

type Daily = Record<string, (number | null)[] | string[]>;

/** The hours a race day is ridden in: 6:00 to 20:00, every two hours. */
export const RACE_HOURS = [6, 8, 10, 12, 14, 16, 18, 20];

/** Open-Meteo's hourly rows (local time) cut down to the race day's hours. */
export function raceDayHours(h: Daily | undefined): ForecastHour[] {
  const times = (h?.time as string[] | undefined) ?? [];
  const num = (k: string, i: number) => (h?.[k] as (number | null)[] | undefined)?.[i] ?? null;
  return times.flatMap((time, i) => {
    const hour = Number(time.slice(11, 13));
    const temp = num("temperature_2m", i);
    const code = num("weather_code", i);
    if (!RACE_HOURS.includes(hour) || temp == null || code == null ||
      ["precipitation", "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m", "is_day"].some(key => num(key, i) == null)) return [];
    return [{
      hour,
      temp: round(temp),
      rainMm: Math.round((num("precipitation", i) ?? 0) * 10) / 10,
      rainChance: num("precipitation_probability", i),
      windKmh: round(num("wind_speed_10m", i) ?? 0),
      gustKmh: round(num("wind_gusts_10m", i) ?? 0),
      windFrom: round(num("wind_direction_10m", i) ?? 0),
      sky: skyOf(code),
      day: num("is_day", i) !== 0,
    }];
  });
}

async function forecastFor(lat: number, lng: number, date: string): Promise<Forecast | null> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code",
    hourly: "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day",
    timezone: "auto",
    start_date: date,
    end_date: date,
  });
  const json = await getJson(`https://api.open-meteo.com/v1/forecast?${q}`, 6000);
  const d = json?.daily as Daily | undefined;
  const at = (k: string) => (d?.[k] as (number | null)[] | undefined)?.[0] ?? null;
  const tmax = at("temperature_2m_max");
  const tmin = at("temperature_2m_min");
  const code = at("weather_code");
  if (tmax == null || tmin == null || code == null || at("precipitation_sum") == null || at("wind_speed_10m_max") == null) return null;
  return {
    source: "open-meteo",
    tmax: round(tmax),
    tmin: round(tmin),
    rainChance: at("precipitation_probability_max"),
    rainMm: Math.round((at("precipitation_sum") ?? 0) * 10) / 10,
    windKmh: round(at("wind_speed_10m_max") ?? 0),
    sky: skyOf(code),
    hours: raceDayHours(json?.hourly as Daily | undefined),
  };
}

/** The days of each past year within the window around the race's day of the year, overall and year by year. */
export function climateFrom(days: string[], tmax: (number | null)[], tmin: (number | null)[], rain: (number | null)[], date: string,
  options?: { firstYear: number; lastYear: number; fullWindow?: boolean }): Climate | null {
  const md = date.slice(5) === "02-29" ? "02-28" : date.slice(5);
  const years = new Map<number, { hi: number[]; lo: number[]; rain: number; rainy: number }>();
  days.forEach((day, i) => {
    if (tmax[i] == null || tmin[i] == null || rain[i] == null) return;
    const y = Number(day.slice(0, 4));
    // A January week includes December; group it by its central race date.
    const centers = [y - 1, y, y + 1].map(year => ({ year, distance: Math.abs(daysBetween(`${year}-${md}`, day)) }));
    const center = centers.sort((a, b) => a.distance - b.distance)[0];
    if (center.distance > CLIMATE_WINDOW || options && (center.year < options.firstYear || center.year > options.lastYear)) return;
    const held = years.get(center.year) ?? { hi: [], lo: [], rain: 0, rainy: 0 };
    held.hi.push(tmax[i]!); held.lo.push(tmin[i]!); held.rain += rain[i]!;
    if (rain[i]! >= 1) held.rainy++;
    years.set(center.year, held);
  });
  const valid = [...years].filter(([, y]) => !options?.fullWindow || y.hi.length === CLIMATE_WINDOW * 2 + 1).sort(([a], [b]) => a - b);
  if (!valid.length) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const hi = valid.flatMap(([, y]) => y.hi), lo = valid.flatMap(([, y]) => y.lo);
  return {
    tmax: round(avg(hi)), tmin: round(avg(lo)),
    rainyShare: Math.round(valid.reduce((n, [, y]) => n + y.rainy, 0) / hi.length * 100) / 100,
    years: valid.length,
    byYear: valid.map(([year, y]) => ({ year, tmax: round(avg(y.hi)), tmin: round(avg(y.lo)), rainMm: Math.round(y.rain) })),
  };
}

async function openMeteoHistory(lat: number, lng: number, dates: string[], today: string): Promise<Record<string, Climate>> {
  const lastYear = Number(today.slice(0, 4)) - 1;
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: new Date(Date.UTC(lastYear - CLIMATE_YEARS + 1, 0, 1 - CLIMATE_WINDOW)).toISOString().slice(0, 10),
    end_date: `${lastYear + 1}-01-0${CLIMATE_WINDOW}`,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "auto",
  });
  const json = await getJson(`https://archive-api.open-meteo.com/v1/archive?${q}`, 6000);
  const d = json?.daily as Daily | undefined;
  if (!d?.time) throw new Error("weather_archive_unavailable");
  const result: Record<string, Climate> = {};
  for (const date of dates) {
    const climate = climateFrom(d.time as string[], d.temperature_2m_max as (number | null)[], d.temperature_2m_min as (number | null)[], d.precipitation_sum as (number | null)[], date, { firstYear: lastYear - CLIMATE_YEARS + 1, lastYear, fullWindow: true });
    if (!climate || climate.years < CLIMATE_YEARS) throw new Error("weather_archive_incomplete");
    result[date.slice(5)] = { ...climate, source: "open-meteo", referenceYear: lastYear };
  }
  return result;
}

export async function historicalSummaries(lat: number, lng: number, dates: string[], today: string) {
  try { return await openMeteoHistory(lat, lng, dates, today); }
  catch { return (await import("@/lib/weather-visual-crossing")).visualCrossingHistory(lat, lng, dates, today); }
}

/** Whether a race on `date` is close enough for a forecast. */
export function wantsForecast(date: string, today: string): boolean {
  const ahead = daysBetween(today, date);
  return ahead >= 0 && ahead <= FORECAST_DAYS;
}

export async function raceWeather(lat: number, lng: number, date: string, today: string, climate: Climate | null = null): Promise<RaceWeather> {
  let forecast = wantsForecast(date, today) ? await forecastFor(lat, lng, date).catch(() => null) : null;
  if (!forecast && wantsForecast(date, today)) forecast = await (await import("@/lib/weather-visual-crossing")).visualCrossingForecastFor(lat, lng, date).catch(() => null);
  return { forecast, climate, forecastFetchedAt: forecast ? new Date().toISOString() : null };
}
