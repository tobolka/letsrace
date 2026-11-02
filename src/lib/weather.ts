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
export type Climate = { tmax: number; tmin: number; rainyShare: number; years: number; byYear: ClimateYear[] };
export type RaceWeather = { forecast: Forecast | null; climate: Climate | null };

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

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
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
    if (!RACE_HOURS.includes(hour) || temp == null || code == null) return [];
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
  const json = await getJson(`https://api.open-meteo.com/v1/forecast?${q}`);
  const d = json?.daily as Daily | undefined;
  const at = (k: string) => (d?.[k] as (number | null)[] | undefined)?.[0] ?? null;
  const tmax = at("temperature_2m_max");
  const tmin = at("temperature_2m_min");
  const code = at("weather_code");
  if (tmax == null || tmin == null || code == null) return null;
  return {
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
export function climateFrom(days: string[], tmax: (number | null)[], tmin: (number | null)[], rain: (number | null)[], date: string): Climate | null {
  const md = date.slice(5);
  const hi: number[] = [];
  const lo: number[] = [];
  let rainy = 0;
  const perYear = new Map<number, { hi: number[]; lo: number[]; rain: number }>();
  days.forEach((day, i) => {
    const sameDay = `${day.slice(0, 4)}-${md === "02-29" ? "02-28" : md}`;
    if (Math.abs(daysBetween(sameDay, day)) > CLIMATE_WINDOW) return;
    if (tmax[i] == null || tmin[i] == null) return;
    hi.push(tmax[i]!);
    lo.push(tmin[i]!);
    if ((rain[i] ?? 0) >= 1) rainy += 1;
    const year = Number(day.slice(0, 4));
    const y = perYear.get(year) ?? { hi: [], lo: [], rain: 0 };
    y.hi.push(tmax[i]!);
    y.lo.push(tmin[i]!);
    y.rain += rain[i] ?? 0;
    perYear.set(year, y);
  });
  if (!hi.length) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const byYear = [...perYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, y]) => ({ year, tmax: round(avg(y.hi)), tmin: round(avg(y.lo)), rainMm: Math.round(y.rain) }));
  return { tmax: round(avg(hi)), tmin: round(avg(lo)), rainyShare: Math.round((rainy / hi.length) * 100) / 100, years: byYear.length, byYear };
}

async function climateFor(lat: number, lng: number, date: string, today: string): Promise<Climate | null> {
  const lastYear = Number(today.slice(0, 4)) - 1;
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: `${lastYear - CLIMATE_YEARS + 1}-01-01`,
    end_date: `${lastYear}-12-31`,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone: "auto",
  });
  const json = await getJson(`https://archive-api.open-meteo.com/v1/archive?${q}`);
  const d = json?.daily as Daily | undefined;
  if (!d?.time) return null;
  return climateFrom(
    d.time as string[],
    d.temperature_2m_max as (number | null)[],
    d.temperature_2m_min as (number | null)[],
    d.precipitation_sum as (number | null)[],
    date,
  );
}

/** Whether a race on `date` is close enough for a forecast. */
export function wantsForecast(date: string, today: string): boolean {
  const ahead = daysBetween(today, date);
  return ahead >= 0 && ahead <= FORECAST_DAYS;
}

export async function raceWeather(lat: number, lng: number, date: string, today: string): Promise<RaceWeather> {
  const [forecast, climate] = await Promise.all([
    wantsForecast(date, today) ? forecastFor(lat, lng, date).catch(() => null) : Promise.resolve(null),
    climateFor(lat, lng, date, today).catch(() => null),
  ]);
  return { forecast, climate };
}
