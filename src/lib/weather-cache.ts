import { FORECAST_DAYS, wantsForecast, type RaceWeather } from "@/lib/weather";

/** Even a good historical answer must expire before the forecast becomes available. */
export function weatherCacheSeconds(weather: RaceWeather, date: string, now = Date.now()): number {
  const today = new Date(now).toISOString().slice(0, 10);
  const near = wantsForecast(date, today);
  if (near) {
    if (!weather.forecast) return 60;
    const fetched = weather.forecastFetchedAt ? Date.parse(weather.forecastFetchedAt) : now;
    return Math.max(1, Math.floor(1800 - Math.max(0, now - fetched) / 1000));
  }
  if (!weather.climate) return 300;
  const boundary = Date.parse(`${date}T00:00:00Z`) - FORECAST_DAYS * 86400_000;
  return Math.max(1, Math.min(86400, Math.floor((boundary - now) / 1000)));
}

/** In-flight deduplication with expiry: neither failures nor forecasts live forever. */
export function createWeatherLoader(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { until: number; promise: Promise<RaceWeather | null> }>();
  return (lat: number, lng: number, date: string) => {
    const key = new URLSearchParams({ v: "2", lat: lat.toFixed(2), lng: lng.toFixed(2), date }).toString();
    const held = cache.get(key);
    if (held && held.until > now()) return held.promise;
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    const entry = { until: Infinity, promise: Promise.resolve(null) as Promise<RaceWeather | null> };
    entry.promise = fetcher(`/api/weather?${key}`, { signal: AbortSignal.timeout(20_000) })
      .then(async res => res.ok ? await res.json() as RaceWeather : null).catch(() => null)
      .then(value => { entry.until = now() + (value ? weatherCacheSeconds(value, date, now()) : 60) * 1000; return value; });
    cache.set(key, entry);
    return entry.promise;
  };
}
