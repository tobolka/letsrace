/** Targeted audit of user claims. This is reading evaluation, never blind discovery or a database writer. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parse as loadEnv } from "dotenv";
import { hash } from "../src/lib/discovery/plan";
import { parseBenchmark } from "../src/lib/discovery/report";
import { auditBenchmarkRow, verifyBenchmarkAssertion, type BenchmarkAssertion } from "../src/lib/discovery/benchmark";
import { fetchPage } from "../src/lib/watcher/http";
import { mapPool } from "../src/lib/watcher/pool";
import { pageAsText } from "../src/lib/watcher/extractors/llm-calendar";

async function main() {
  const env = loadEnv(await readFile(".env.local", "utf8"));
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
  process.env.LLM_LEDGER_PATH ??= resolve("tmp/llm-budget.json");
  process.env.LLM_DAILY_BUDGET_USD ??= "0.50";
  process.env.LLM_MONTHLY_BUDGET_USD ??= "5.00";
  process.env.LLM_EXTRACTION_CACHE_DIR ??= resolve("tmp/extraction-cache");
  const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const directory = resolve(arg("out") ?? "tmp/discovery-audit-2026-10-24");
  const sourceDir = resolve(arg("sources") ?? "tmp/discovery-pilot-2026-10-24/benchmark-final/documents");
  const previousRows = arg("recheck") ? (JSON.parse(await readFile(resolve(arg("recheck")!), "utf8")) as {
    rows: Array<{ row: unknown; sourceHash?: string; assertion?: BenchmarkAssertion; readerVersion?: string; model?: string }>
  }).rows : [];
  const rows = parseBenchmark(await readFile("docs/fixtures/cyklisticke_zavody_cr_2027.csv", "utf8"));
  await mkdir(join(directory, "documents"), { recursive: true });
  const docs = new Map<string, { html: string; status: number; hash: string; method: string }>();
  for (const url of [...new Set(rows.map(r => r.url))]) {
    try {
      const previous = JSON.parse(await readFile(join(sourceDir, `${hash(url)}.json`), "utf8"));
      docs.set(url, { ...previous, method: previous.method ?? "saved_http_snapshot" });
    } catch {
      try { docs.set(url, { ...await fetchPage(url, { timeoutMs: 20_000, retries: 0 }), method: "http" }); }
      catch (error) { console.log(`unreadable: ${url}: ${error instanceof Error ? error.message : error}`); }
    }
  }
  if (process.argv.includes("--render")) {
    const thin = [...new Set(rows.map(r => r.url))].filter(url => !docs.has(url) || pageAsText(docs.get(url)!.html, url).text.length < 500);
    const { renderPagesHtml } = await import("../src/lib/watcher/extractors/csc-render");
    for (let at = 0; at < thin.length; at += 3) {
      const rendered = await renderPagesHtml(thin.slice(at, at + 3), { settleMs: 4000, budgetMs: 45_000 });
      for (const [url, html] of rendered) docs.set(url, { html, status: 200, hash: hash(html), method: "local_browser" });
    }
  }
  for (const [url, doc] of docs) await writeFile(join(directory, "documents", `${hash(url)}.json`), JSON.stringify({ ...doc, url }));
  const results = await mapPool(rows, 3, async row => {
    const doc = docs.get(row.url);
    if (!doc || doc.status !== 200 || pageAsText(doc.html, row.url).text.length < 100) return { row, status: "unreadable", sourceHash: doc?.hash, sourceMethod: doc?.method };
    try {
      const previous = previousRows.find(r => JSON.stringify(r.row) === JSON.stringify(row) && r.sourceHash === doc.hash && r.assertion);
      const verdict = previous?.assertion ? { ...verifyBenchmarkAssertion(previous.assertion, row, doc.html, 2027),
        assertion: previous.assertion, readerVersion: previous.readerVersion, model: previous.model, cached: true, modelCostUsd: 0 }
        : await auditBenchmarkRow(row, doc.html, 2027);
      console.log(verdict.status, row.name, verdict.event?.startDate ?? "", verdict.identityNeedsReview ? "identity review" : "");
      const result = { row, ...verdict, sourceHash: doc.hash, sourceMethod: doc.method };
      await writeFile(join(directory, `${hash(JSON.stringify(row))}.json`), JSON.stringify(result, null, 2));
      return result;
    } catch (error) { return { row, status: "deferred", error: error instanceof Error ? error.message : String(error), sourceHash: doc.hash, sourceMethod: doc.method }; }
  });
  const summary = { generatedAt: new Date().toISOString(), purpose: "Targeted CSV claim verification, not blind search or publication approval", rows: results,
    counts: Object.fromEntries([...new Set(results.map(r => r.status))].map(s => [s, results.filter(r => r.status === s).length])) };
  await writeFile(join(directory, "report.json"), JSON.stringify(summary, null, 2));
  console.log(summary.counts, join(directory, "report.json"));
  if (results.some(r => r.status === "deferred")) process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
