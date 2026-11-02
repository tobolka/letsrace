import { afterEach, describe, expect, it, vi } from "vitest";
import { visualCrossingForecast, visualCrossingHistory } from "@/lib/weather-visual-crossing";

afterEach(() => vi.unstubAllGlobals());
describe("independent weather fallback", () => {
  it("keeps local racing hours and refuses missing values or a different day", () => {
    const day = { datetime: "2026-11-07", tempmax: 7, tempmin: 1, precip: 0, windspeed: 5, icon: "clear-day", sunrise: "07:00:00", sunset: "16:00:00", hours: [
      { datetime: "08:00:00", temp: 3, precip: 0, windspeed: 4, windgust: 10, winddir: 90, icon: "partly-cloudy-day" },
      { datetime: "20:00:00", temp: 2, precip: 0, windspeed: 4, windgust: 8, winddir: 90, icon: "clear-night" },
    ] };
    const forecast = visualCrossingForecast(day, "2026-11-07");
    expect(forecast?.source).toBe("visual-crossing");
    expect(forecast?.hours.map(h => [h.hour, h.day])).toEqual([[8, true], [20, false]]);
    expect(visualCrossingForecast({ ...day, precip: undefined }, "2026-11-07")).toBeNull();
    expect(visualCrossingForecast(day, "2026-11-08")).toBeNull();
  });
  it("reads ten short historical windows, with no key, and refuses incomplete years", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).not.toContain("key=");
      expect(init?.headers).toMatchObject({ "Accept-Encoding": "gzip" });
      const [from, to] = new URL(url).pathname.split("/").slice(-2);
      const days = [];
      for (let time = Date.parse(from); time <= Date.parse(to); time += 86400_000) days.push({ datetime: new Date(time).toISOString().slice(0, 10), tempmax: 12, tempmin: 3, precip: 1 });
      return new Response(JSON.stringify({ days }));
    });
    vi.stubGlobal("fetch", fetcher);
    const history = await visualCrossingHistory(50, 14, ["2027-01-01"], "2026-11-02");
    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(history["01-01"].years).toBe(10);
    expect(history["01-01"].byYear[0]).toEqual({ year: 2016, tmax: 12, tmin: 3, rainMm: 7 });
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ days: [] })));
    await expect(visualCrossingHistory(50, 14, ["2027-01-01"], "2026-11-02")).rejects.toThrow("incomplete");
  });
});
