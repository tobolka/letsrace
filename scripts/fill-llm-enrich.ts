/**
 * Discipline, categories, entry and regulations links, read from a race's own
 * pages by a language model that must quote the page.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-llm-enrich.ts [--max=60] [--ids=a,b [--keep-memory]] [--fix-disciplines] [--past] [--apply]
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
  const run = (chunk?: string[]) => enrichFromPages({ max, ids: chunk, keepMemory: process.argv.includes("--keep-memory"), dryRun: !apply, fixDisciplines: process.argv.includes("--fix-disciplines"), past: process.argv.includes("--past"), agesOnly: process.argv.includes("--ages"), reviewFile, log: console.log });
  // Many ids in one query make an address too long for the database API, which
  // then answers nothing: read them in batches and add the counts up.
  type Tally = Record<string, number | Record<string, number>>;
  const add = (a: Tally, b: Tally): Tally => {
    for (const [k, v] of Object.entries(b)) {
      if (typeof v === "number") a[k] = ((a[k] as number) ?? 0) + v;
      else a[k] = add({ ...((a[k] as Tally) ?? {}) }, v as Tally) as Record<string, number>;
    }
    return a;
  };
  let r: Tally = {};
  if (!ids?.length) r = (await run()) as unknown as Tally;
  else for (let i = 0; i < ids.length; i += 150) r = add(r, (await run(ids.slice(i, i + 150))) as unknown as Tally);
  console.log({ ...r, costUsd: Number(((r.costUsd as number) ?? 0).toFixed(3)), dry: !apply, review: reviewFile });
}
main().catch((e) => { console.error(e); process.exit(1); });
