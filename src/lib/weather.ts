import { openMeteoUnits, reserveWeatherRequests, weatherRequest, WeatherDeferred } from "@/lib/weather-request";
import { archiveWindows, climateFrom, CLIMATE_YEARS, raceDayHours, skyOf, wantsForecast, type Climate, type Daily, type Forecast, type RaceWeather } from "@/lib/weather-model";
export * from "@/lib/weather-model";
const round = (n: number) => Math.round(n);

async function getJson(url: string, timeoutMs = 12000, deadline = Date.now() + timeoutMs, token?: string): Promise<Record<string, unknown> | null> {
  return weatherRequest("open-meteo", url, openMeteoUnits(url), deadline, timeoutMs, {}, new URL(url).hostname === "archive-api.open-meteo.com", token);
}

async function forecastFor(lat: number, lng: number, date: string, deadline: number): Promise<Forecast | null> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code",
    hourly: "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day",
    timezone: "auto",
    start_date: date,
    end_date: date,
  });
  const json = await getJson(`https://api.open-meteo.com/v1/forecast?${q}`, 6000, deadline);
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

async function openMeteoHistory(lat: number, lng: number, dates: string[], today: string, deadline: number): Promise<Record<string, Climate>> {
  const lastYear = Number(today.slice(0, 4)) - 1;
  // Only the week around each race date in each year, not ten whole years:
  // Open-Meteo weighs a request by the data it returns, and ten years of days
  // cost about eighty requests per place — the free budget ran out after a
  // hundred places. Seven days per year is about a tenth of that.
  const windows = archiveWindows(dates, lastYear);
  const tokens = await reserveWeatherRequests("open-meteo", windows.map(([from, to]) => Math.ceil(Math.max(1, (Date.parse(to) - Date.parse(from) + 86400_000) / (14 * 86400_000)))), deadline);
  const rows = new Map<string, [number | null, number | null, number | null]>();
  for (let i = 0; i < windows.length; i += 2) {
    if (Date.now() >= deadline) throw new WeatherDeferred("deadline");
    await Promise.all(windows.slice(i, i + 2).map(async ([from, to], j) => {
      const q = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        start_date: from,
        end_date: to,
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
        timezone: "auto",
      });
      const json = await getJson(`https://archive-api.open-meteo.com/v1/archive?${q}`, 6000, deadline, tokens[i + j]);
      const d = json?.daily as Daily | undefined;
      if (!d?.time) throw new Error("weather_archive_unavailable");
      (d.time as string[]).forEach((day, k) => rows.set(day, [
        (d.temperature_2m_max as (number | null)[])[k] ?? null,
        (d.temperature_2m_min as (number | null)[])[k] ?? null,
        (d.precipitation_sum as (number | null)[])[k] ?? null,
      ]));
    }));
  }
  const days = [...rows.keys()].sort();
  const pick = (n: 0 | 1 | 2) => days.map((day) => rows.get(day)![n]);
  const d = { time: days, temperature_2m_max: pick(0), temperature_2m_min: pick(1), precipitation_sum: pick(2) };
  const result: Record<string, Climate> = {};
  for (const date of dates) {
    const climate = climateFrom(d.time, d.temperature_2m_max, d.temperature_2m_min, d.precipitation_sum, date, { firstYear: lastYear - CLIMATE_YEARS + 1, lastYear, fullWindow: true });
    if (!climate || climate.years < CLIMATE_YEARS) throw new Error("weather_archive_incomplete");
    result[date.slice(5)] = { ...climate, source: "open-meteo", referenceYear: lastYear };
  }
  return result;
}

export async function historicalSummaries(lat: number, lng: number, dates: string[], today: string, deadline = Date.now() + 25_000) {
  try { return await openMeteoHistory(lat, lng, dates, today, deadline); }
  catch {
    if (Date.now() >= deadline) throw new WeatherDeferred("deadline");
    return (await import("@/lib/weather-visual-crossing")).visualCrossingHistory(lat, lng, dates, today, deadline);
  }
}

export async function raceWeather(lat: number, lng: number, date: string, today: string, climate: Climate | null = null): Promise<RaceWeather> {
  const deadline = Date.now() + 15_000;
  let forecast = wantsForecast(date, today) ? await forecastFor(lat, lng, date, deadline).catch(() => null) : null;
  if (!forecast && wantsForecast(date, today)) forecast = await (await import("@/lib/weather-visual-crossing")).visualCrossingForecastFor(lat, lng, date, deadline).catch(() => null);
  return { forecast, climate, forecastFetchedAt: forecast ? new Date().toISOString() : null };
}
