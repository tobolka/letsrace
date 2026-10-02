/**
 * Discipline, categories, entry and regulations links, read from a race's own
 * pages by a language model that must quote the page.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-llm-enrich.ts [--max=60] [--ids=a,b] [--fix-disciplines] [--apply]
 * Needs ANTHROPIC_API_KEY in .env.local. Prints tokens and cost.
 * Disagreements about the discipline go to tmp/llm-review-<date>.tsv.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { enrichFromPages } = await import("../src/lib/catalog/llm-enrich");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 60);
  const ids = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",");
  const reviewFile = `tmp/llm-review-${new Date().toISOString().slice(0, 10)}.tsv`;
  const r = await enrichFromPages({ max, ids, dryRun: !apply, fixDisciplines: process.argv.includes("--fix-disciplines"), reviewFile, log: console.log });
  console.log({ ...r, costUsd: Number(r.costUsd.toFixed(3)), dry: !apply, review: reviewFile });
}
main().catch((e) => { console.error(e); process.exit(1); });
