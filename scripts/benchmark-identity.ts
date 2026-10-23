/** Deterministic regression comparison; no network, database or model calls. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scoreDuplicate as current, DEDUP_THRESHOLD, type DedupEvent } from "../src/lib/dedup";

const arg = (key: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
async function main() {
  const baseline = arg("baseline");
  const scorer = baseline ? (await import(pathToFileURL(resolve(baseline)).href)).scoreDuplicate as typeof current : current;
  const cases = JSON.parse(await readFile(arg("cases") ?? "reports/pipeline-refactor-2026-10-23/identity-cases.json", "utf8")) as { label: string; duplicate: boolean; a: DedupEvent; b: DedupEvent }[];
  const results = cases.map(c => {
    const score = scorer(c.a, c.b);
    const predicted = score.score >= DEDUP_THRESHOLD;
    return { label: c.label, expected: c.duplicate, predicted, correct: predicted === c.duplicate, ...score };
  });
  const report = { mode: baseline ? "baseline" : "current", source: baseline ?? "src/lib/dedup.ts", cases: cases.length,
    correct: results.filter(r => r.correct).length,
    falseMerges: results.filter(r => r.predicted && !r.expected).length,
    missedMatches: results.filter(r => !r.predicted && r.expected).length, results };
  if (arg("out")) await writeFile(resolve(arg("out")!), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
