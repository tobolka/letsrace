/** Compare readers on archived real documents. No database writes or web downloads. */
import { config } from "dotenv";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { HAIKU, LEGACY_HAIKU, llmSpent } from "../src/lib/llm/anthropic";
import { readSeriesDocument } from "../src/lib/catalog/series-document-reader";
import { verifySeriesDocument, roundWithinSeriesSeason } from "../src/lib/catalog/series-documents";
config({ path: ".env.local", quiet: true });
process.env.LLM_BUDGET_USD ??= "0.30";
process.env.LLM_LEDGER_PATH ??= resolve("tmp/llm-budget.json");
process.env.LLM_DAILY_BUDGET_USD ??= "2.50";
process.env.LLM_MONTHLY_BUDGET_USD ??= "25";
const cases = [
  { file: "99a62a69-0605-4a05-8495-652490fda9ff", name: "JANEV Cup", url: "rozpis-janev", date: "2026-10-31" },
  { file: "03fc8da7-c963-4df2-9dc3-3a10bc2252bb", name: "ProTour Cyclocross Cup", url: "protour-cyclocross-cup-2026-regulamin", date: "2026-11-08" },
  { file: "43ed3e2d-1e73-480d-ab20-937d62e67efa", name: "Polish Bike Tour 2026", url: "polishbiketour.pl/regulamin", date: "2026-10-11" },
  // A 2027 document must not be applied to a 2026 round.
  { file: "4c56fc1b-f40b-423a-b85e-0c81e9e1a7b3", name: "Hardy Gravel", url: "hardygravel.cc/regulamin/", date: "2026-10-11" },
];
async function main() {
  const directory = process.argv.find(a => a.startsWith("--dossier-dir="))?.slice(14) ?? "tmp/source-dossiers";
  if (process.argv.includes("--replay")) {
    const previous = JSON.parse(readFileSync("tmp/import-model-benchmark.json", "utf8")) as { results: { name: string; model: string; verdict?: import("../src/lib/catalog/series-documents").SeriesDocumentVerdict }[] };
    const replay = previous.results.map(result => {
      const test = cases.find(c => c.name === result.name)!;
      const archive = JSON.parse(readFileSync(resolve(directory, `${test.file}.json`), "utf8")) as { documents: { url: string; text: string }[] };
      const document = archive.documents.find(d => d.url.includes(test.url))!;
      const evidence = verifySeriesDocument(test.name, document.text, result.verdict ?? null);
      return { name: test.name, model: result.model, sourceUrl: document.url, verified: Boolean(evidence), eligible: evidence ? roundWithinSeriesSeason(test.date, evidence) : false, evidence };
    });
    writeFileSync("tmp/import-model-replay.json", JSON.stringify(replay, null, 2));
    console.log(JSON.stringify(replay.map(r => ({ ...r, evidence: r.evidence ? { ages: r.evidence.ages, rules: r.evidence.rules } : null })), null, 2));
    return;
  }
  const models = process.argv.includes("--compare-legacy") ? [HAIKU, LEGACY_HAIKU] : [HAIKU];
  const results = [];
  for (const test of cases) {
    const archived = JSON.parse(readFileSync(resolve(directory, `${test.file}.json`), "utf8")) as { documents: { url: string; text: string }[] };
    const document = archived.documents.find(d => d.url.includes(test.url));
    if (!document) throw new Error(`Missing archived document: ${test.name}`);
    for (const model of models) {
      const started = Date.now();
      const before = llmSpent();
      try {
        const answer = await readSeriesDocument(test.name, [{ name: test.name, start_date: test.date }], document.url, document.text, model);
        const evidence = verifySeriesDocument(test.name, document.text, answer?.json ?? null);
        const eligible = evidence ? roundWithinSeriesSeason(test.date, evidence) : false;
        const result = { name: test.name, model, sourceUrl: document.url, chars: document.text.length, previouslySkipped: document.text.length > 14_000,
          ms: Date.now() - started, usage: answer?.usage, verified: Boolean(evidence), eligible,
          ages: eligible ? evidence?.ages ?? [] : [], verdict: answer?.json, evidence };
        results.push(result);
        console.log(JSON.stringify({ ...result, verdict: undefined, evidence: undefined }));
      } catch (error) {
        results.push({ name: test.name, model, ms: Date.now() - started, costUsd: llmSpent() - before, error: String(error) });
        console.log(`${test.name} ${model}: ${String(error)}`);
        process.exitCode = 1;
      } finally {
        mkdirSync("tmp", { recursive: true });
        writeFileSync("tmp/import-model-benchmark.json", JSON.stringify({ createdAt: new Date().toISOString(), costUsd: llmSpent(), results }, null, 2));
      }
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
