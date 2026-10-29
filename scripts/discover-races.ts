/** Independent season discovery, durable local outbox, no event writes. See docs/parallel-race-discovery.md. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parse as loadEnv } from "dotenv";
import { discoveryPlan, DISCOVERY_COUNTRIES, type DiscoveryCountry, type SearchProvider } from "../src/lib/discovery/plan";
import { DiscoveryStore } from "../src/lib/discovery/store";
import { runDiscovery } from "../src/lib/discovery/run";
import { discoveryReport, parseBenchmark, type CatalogRow } from "../src/lib/discovery/report";
import { CALENDAR_READER_VERSION } from "../src/lib/watcher/extractors/llm-calendar";
import { WATCH_READER_VERSION } from "../src/lib/watcher/core";

async function main() {
  try {
    const env = loadEnv(await readFile(".env.local", "utf8"));
    for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  if (process.argv.includes("--help")) {
    console.log("discover-races.ts --country=CZ|SK|AT|DE|PL|CH|IT --season=2027 --mode=search|read|all|benchmark|report [--providers=ai,brave,openai] [--max=20] [--minutes=5] [--concurrency=3] [--no-ai] [--retry-credit] [--catalog] [--queue-leads] [--queue-candidates] [--sources=urls.json] [--out=tmp/discovery/CZ-2027] [--benchmark=path.csv] [--cycle=YYYY-MM-DD]");
    return;
  }
  const mode = arg("mode") ?? "all";
  if (!["search", "read", "all", "benchmark", "report"].includes(mode)) throw new Error("Invalid mode");
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(arg(key) ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid --${key}`);
    return value;
  };
  const season = integer("season", 2027, 2026, 2100);
  const providers = (arg("providers") ?? "ai,brave").split(",");
  if (providers.some(p => !["ai", "brave", "openai"].includes(p))) throw new Error("Invalid --providers");
  const country = (arg("country") ?? "CZ") as DiscoveryCountry;
  if (!DISCOVERY_COUNTRIES.includes(country)) throw new Error("Unsupported --country");
  const plan = discoveryPlan(season, providers as SearchProvider[], country);
  const directory = resolve(arg("out") ?? `tmp/discovery/${country}-${season}`);
  await mkdir(directory, { recursive: true });
  const store = new DiscoveryStore(join(directory, "queue.json"));
  await store.configureCountry(country);
  if (["read", "all", "benchmark"].includes(mode)) await store.configureReader(`${WATCH_READER_VERSION}:${CALENDAR_READER_VERSION}:ai=${!process.argv.includes("--no-ai")}`);
  const max = integer("max", 20, 1, 1000), concurrency = integer("concurrency", 3, 1, 3);
  const minutes = integer("minutes", 5, 1, 120);
  const deadline = Date.now() + minutes * 60_000;
  // Same shared ceilings as the existing refresh scripts. Never reset its ledger.
  process.env.LLM_LEDGER_PATH ??= resolve("tmp/llm-budget.json");
  process.env.LLM_DAILY_BUDGET_USD ??= "0.50";
  process.env.LLM_MONTHLY_BUDGET_USD ??= "5.00";
  process.env.LLM_EXTRACTION_CACHE_DIR ??= resolve("tmp/extraction-cache");
  process.env.SOURCE_DOCUMENT_CACHE_DIR ??= resolve("tmp/source-documents");
  if (process.argv.includes("--retry-credit")) {
    const { ProviderHealth } = await import("../src/lib/llm/provider-health");
    await new ProviderHealth(process.env.LLM_PROVIDER_STATE_PATH || `${process.env.LLM_LEDGER_PATH}.providers.json`).retryCredit("anthropic");
    await store.retryCreditDeferred();
  }
  console.log({ mode, country, season, directory, concurrency, processModelCap: process.env.LLM_BUDGET_USD ?? "0.25",
    dailyModelCap: process.env.LLM_DAILY_BUDGET_USD, monthlyModelCap: process.env.LLM_MONTHLY_BUDGET_USD, eventWrites: false });

  // Benchmark input is never passed to search tasks, even when both lanes share a store.
  const benchmarkPath = arg("benchmark") ?? "docs/fixtures/cyklisticke_zavody_cr_2027.csv";
  const benchmark = country === "CZ" && season === 2027 ? parseBenchmark(await readFile(benchmarkPath, "utf8")) : [];
  if (arg("sources")) {
    const urls: unknown = JSON.parse(await readFile(arg("sources")!, "utf8"));
    if (!Array.isArray(urls) || urls.some(u => typeof u !== "string")) throw new Error("--sources must contain a JSON array of source URLs");
    await store.enqueueSources(urls, season, "blind", "reviewed-source-followup");
  }
  if (mode === "benchmark") await store.enqueueSources(benchmark.map(r => r.url), season, "benchmark", "csv-diagnostic");
  if (mode === "search" || mode === "all") {
    const cycle = arg("cycle") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await store.enqueueSearches(plan, cycle);
    await runDiscovery(store, { directory, mode: "search", max, concurrency, deadline, ai: !process.argv.includes("--no-ai"), log: console.log });
  }
  if (["read", "all", "benchmark"].includes(mode)) {
    await runDiscovery(store, { directory, mode: "read", max, concurrency, deadline, ai: !process.argv.includes("--no-ai"), lane: mode === "benchmark" ? "benchmark" : "blind", log: console.log });
  }
  let catalog: CatalogRow[] | null = null;
  if (process.argv.includes("--catalog")) {
    const { createServerSupabase } = await import("../src/lib/supabase/server");
    const db = createServerSupabase();
    catalog = [];
    // Include all years, hidden records and merged rows; date errors must not defeat comparison.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("events")
        .select("id,name,start_date,visibility,status,merged_into_id,website_url,location:locations(country_code)")
        .order("id").range(offset, offset + 999);
      if (error) throw new Error(`Catalog comparison failed: ${error.message}`);
      for (const r of data ?? []) catalog.push({ ...r, country: r.location?.country_code ?? null });
      if (!data || data.length < 1000) break;
    }
    await writeFile(join(directory, "catalog-snapshot.json"), JSON.stringify({ at: new Date().toISOString(), rows: catalog }, null, 2));
  }
  const state = await store.snapshot();
  if (process.argv.includes("--queue-leads")) {
    const { createServerSupabase } = await import("../src/lib/supabase/server");
    const { queueDiscoverySources } = await import("../src/lib/discovery/sync");
    const handoff = await queueDiscoverySources(createServerSupabase(), state);
    await writeFile(join(directory, "source-handoff.json"), JSON.stringify(handoff, null, 2));
    console.log(handoff);
  }
  if (process.argv.includes("--queue-candidates")) {
    const { createServerSupabase } = await import("../src/lib/supabase/server");
    const { queueDiscoveryCandidates } = await import("../src/lib/discovery/sync");
    const handoff = await queueDiscoveryCandidates(createServerSupabase(), state);
    await writeFile(join(directory, "candidate-handoff.json"), JSON.stringify(handoff, null, 2));
    console.log(handoff);
  }
  const report = { ...discoveryReport(state, benchmark, season, catalog), limits: {
    processModelUsd: process.env.LLM_BUDGET_USD ?? "0.25", dailyModelUsd: process.env.LLM_DAILY_BUDGET_USD,
    monthlyModelUsd: process.env.LLM_MONTHLY_BUDGET_USD, braveQueries: process.env.BRAVE_SEARCH_LIMIT ?? "40", concurrency,
  } };
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(report.metrics);
  console.log(`Report: ${join(directory, "report.json")}`);
  const unfinished = Object.values(state.tasks).some(t => t.status !== "done");
  if (unfinished && mode !== "report") process.exitCode = 2;
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
