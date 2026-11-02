import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { warmWeatherHistory } from "../src/lib/weather-history";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  // A backfill: every place that has no history yet, within an hour.
  const limit = Number(process.argv[2] ?? 1000);
  console.log(JSON.stringify(await warmWeatherHistory(new Date().toISOString().slice(0, 10), Date.now() + 60 * 60_000, limit), null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Weather history failed"); process.exitCode = 1; });
