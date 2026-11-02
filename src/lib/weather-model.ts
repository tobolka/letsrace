/** Pure weather types and calculations shared with the browser; no provider or database access. */
/** Open-Meteo forecasts sixteen days; the last few are too rough to print. */
export const FORECAST_DAYS = 14;
export const CLIMATE_YEARS = 10;
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

export type Daily = Record<string, (number | null)[] | string[]>;

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

/**
 * The date ranges to read for these race dates: the week around each date in
 * each of the last ten years. Dates in a place close together share a range.
 */
export function archiveWindows(dates: string[], lastYear: number): [string, string][] {
  const out: [string, string][] = [];
  const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  for (let year = lastYear - CLIMATE_YEARS + 1; year <= lastYear; year++) {
    const centers = [...new Set(dates.map((date) => `${year}-${date.slice(5) === "02-29" ? "02-28" : date.slice(5)}`))].sort();
    for (const center of centers) {
      const from = shift(center, -CLIMATE_WINDOW);
      const to = shift(center, CLIMATE_WINDOW);
      const last = out.at(-1);
      // Overlapping or touching weeks become one range.
      if (last && from <= shift(last[1], 1)) last[1] = to > last[1] ? to : last[1];
      else out.push([from, to]);
    }
  }
  return out;
}

/** Whether a race on `date` is close enough for a forecast. */
export function wantsForecast(date: string, today: string): boolean {
  const ahead = daysBetween(today, date);
  return ahead >= 0 && ahead <= FORECAST_DAYS;
}
