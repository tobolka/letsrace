import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { resolve } from "node:path";
import { writeJsonAtomic } from "../src/lib/catalog/local-source-cache";

async function main() {
  for (const [key, value] of Object.entries(parse(await readFile(".env.local", "utf8")))) process.env[key] ??= value;
  const arg = (key: string) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  process.env.LLM_EXTRACTION_CACHE_DIR ??= resolve("tmp/extraction-cache");
  for (const [key, limit] of [["LLM_BUDGET_USD", 0.15], ["LLM_DAILY_BUDGET_USD", 0.50], ["LLM_MONTHLY_BUDGET_USD", 5]] as const) {
    const value = Number(process.env[key] ?? limit);
    if (!Number.isFinite(value) || value < 0) throw Error(`Invalid ${key}`);
    process.env[key] = String(Math.min(value, limit));
  }
  const { enrichPracticalDetails } = await import("../src/lib/catalog/practical-enrichment");
  const parent = Number(process.env.SOURCE_RUN_DEADLINE ?? 0) * 1000;
  const minutes = Number(arg("minutes") ?? 8);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 30) throw Error("Invalid run duration");
  const deadline = Math.min(parent > 0 ? parent : Infinity, Date.now() + minutes * 60_000);
  const max = Number(arg("max") ?? 12);
  if (!Number.isInteger(max) || max < 1 || max > 100) throw Error("Invalid batch size");
  const audit: unknown[] = [];
  const result = await enrichPracticalDetails({ max, ids: arg("ids")?.split(","), apply: process.argv.includes("--apply"), structuredOnly: process.argv.includes("--structured-only"), deadline, log: console.log, audit: arg("audit") ? async value => { audit.push(value); await writeJsonAtomic(resolve(arg("audit")!), audit); } : undefined });
  console.log(result);
  if (result.failed && !process.argv.includes("--tolerate-unreadable")) process.exitCode = 1; else if (result.deferred) process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Practical reader failed"); process.exitCode = 1; });
