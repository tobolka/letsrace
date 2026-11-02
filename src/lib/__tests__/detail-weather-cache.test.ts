import { describe, expect, it, vi } from "vitest";
import { weatherCacheSeconds, createWeatherLoader, currentWeather } from "@/lib/weather-cache";
import { historyTargets } from "@/lib/weather-history";
import { categoryFromLabel } from "@/lib/catalog/category-label";
import type { RaceWeather } from "@/lib/weather";

const historical: RaceWeather = { forecast: null, climate: { tmax: 20, tmin: 9, rainyShare: 0.3, years: 10, byYear: [] } };
describe("weather retention", () => {
  it("expires before a distant race enters the forecast window", () => {
    expect(weatherCacheSeconds(historical, "2026-11-17", Date.parse("2026-11-02T23:59:00Z"))).toBe(60);
    expect(weatherCacheSeconds(historical, "2026-11-17", Date.parse("2026-11-03T00:00:00Z"))).toBe(60);
  });
  it("never adds another full cache lifetime to an older forecast", () => {
    const now = Date.parse("2026-11-02T12:00:00Z");
    const weather = { ...historical, forecast: { tmax: 10, tmin: 1, rainChance: 0, rainMm: 0, windKmh: 5, sky: "clear" as const, hours: [] }, forecastFetchedAt: "2026-11-02T11:35:00Z" };
    expect(weatherCacheSeconds(weather, "2026-11-07", now)).toBe(300);
    expect(weatherCacheSeconds(weather, "2026-11-07", now + 600_000)).toBe(1);
    expect(currentWeather(weather, now + 600_000)?.forecast).toBeNull();
    expect(currentWeather(weather, now + 600_000)?.climate).toEqual(historical.climate);
  });
  it("deduplicates concurrent readers and retries failed requests after expiry", async () => {
    let now = Date.parse("2026-11-02T12:00:00Z");
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Response(JSON.stringify(historical)));
    const load = createWeatherLoader(fetcher, () => now);
    expect(await Promise.all([load(50, 14, "2027-05-10"), load(50, 14, "2027-05-10")])).toEqual([null, null]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 61_000;
    expect(await load(50, 14, "2027-05-10")).toEqual(historical);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("shares history between rounded locations and annual editions", () => {
    expect(historyTargets([
      { start_date: "2026-11-07", location: { lat: 50.081, lng: 14.441 } },
      { start_date: "2027-11-07", location: { lat: 50.082, lng: 14.442 } },
      { start_date: "2027-06-01", location: { lat: 50.082, lng: 14.442 } },
    ])).toEqual([{ lat: 50.08, lng: 14.44, dates: ["2026-11-07", "2027-06-01"] }]);
  });
  it("does not turn class numbers or birth years into distances or ages", () => {
    expect(categoryFromLabel("U17 2010–2011")).toEqual({ name: "U17 2010–2011" });
    expect(categoryFromLabel("Etapa 2: 20 km + 10 km").distanceKm).toBeUndefined();
  });
});
