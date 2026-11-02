/** Read-only smoke test: no accounts, paid keys or catalogue writes. */
import { raceWeather, historicalSummaries } from "../src/lib/weather";

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const date = new Date(Date.parse(`${today}T00:00:00Z`) + 5 * 86400_000).toISOString().slice(0, 10);
  const forecast = await raceWeather(50.08, 14.44, date, today);
  const history = await historicalSummaries(50.08, 14.44, [date], today);
  console.log(JSON.stringify({ date, forecastSource: forecast.forecast?.source ?? null, forecastHours: forecast.forecast?.hours.length ?? 0,
    forecastFetchedAt: forecast.forecastFetchedAt, historySource: history[date.slice(5)]?.source,
    historicalYears: history[date.slice(5)]?.years, referenceYear: history[date.slice(5)]?.referenceYear,
    catalogueWrites: 0 }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Weather provider check failed"); process.exitCode = 1; });
