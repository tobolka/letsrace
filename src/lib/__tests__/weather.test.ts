import { describe, expect, it } from "vitest";
import { climateFrom, RACE_HOURS, raceDayHours, skyOf, wantsForecast } from "@/lib/weather";

describe("weather", () => {
  it("reads WMO codes as the sky a rider dresses for", () => {
    expect([0, 2, 3, 45, 61, 73, 95].map(skyOf)).toEqual(["clear", "partly", "cloudy", "fog", "rain", "snow", "storm"]);
  });

  it("forecasts only the next fortnight", () => {
    expect(wantsForecast("2027-05-10", "2027-05-01")).toBe(true);
    expect(wantsForecast("2027-06-10", "2027-05-01")).toBe(false);
    expect(wantsForecast("2027-04-30", "2027-05-01")).toBe(false);
  });

  it("averages the days around the race's date in past years", () => {
    const days = ["2024-05-08", "2024-05-10", "2024-06-30", "2025-05-12", "2025-05-20"];
    const climate = climateFrom(days, [20, 22, 35, 18, 30], [8, 10, 20, 6, 15], [0, 5, 0, 1, 0], "2027-05-10");
    expect(climate).toEqual({
      tmax: 20,
      tmin: 8,
      rainyShare: 0.67,
      years: 2,
      byYear: [
        { year: 2024, tmax: 21, tmin: 9, rainMm: 5 },
        { year: 2025, tmax: 18, tmin: 6, rainMm: 1 },
      ],
    });
  });

  it("gives nothing without data", () => {
    expect(climateFrom([], [], [], [], "2027-05-10")).toBeNull();
  });
  it("does not count missing rainfall as a dry day", () => {
    expect(climateFrom(["2025-05-10"], [20], [10], [null], "2027-05-10")).toBeNull();
  });
  it("includes December in a complete January historical week", () => {
    const days = ["2024-12-29", "2024-12-30", "2024-12-31", "2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"];
    const result = climateFrom(days, days.map(() => 5), days.map(() => 0), days.map(() => 1), "2027-01-01", { firstYear: 2025, lastYear: 2025, fullWindow: true });
    expect(result?.years).toBe(1);
    expect(result?.byYear).toEqual([{ year: 2025, tmax: 5, tmin: 0, rainMm: 7 }]);
  });
});

describe("raceDayHours", () => {
  it("keeps the race day's hours every two hours, in local time", () => {
    const time = Array.from({ length: 24 }, (_, h) => `2027-05-10T${String(h).padStart(2, "0")}:00`);
    const hours = raceDayHours({
      time,
      temperature_2m: time.map((_, h) => 10 + h / 2),
      precipitation: time.map(() => 0.04),
      precipitation_probability: time.map(() => 30),
      wind_speed_10m: time.map(() => 12.4),
      wind_gusts_10m: time.map(() => 25),
      wind_direction_10m: time.map(() => 270),
      weather_code: time.map(() => 2),
      is_day: time.map((_, h) => (h >= 7 && h < 19 ? 1 : 0)),
    });
    expect(hours.map((h) => h.hour)).toEqual(RACE_HOURS);
    expect(hours[0]).toEqual({ hour: 6, temp: 13, rainMm: 0, rainChance: 30, windKmh: 12, gustKmh: 25, windFrom: 270, sky: "partly", day: false });
  });
});
