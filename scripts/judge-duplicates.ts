/**
 * Duplicates judged by a language model: merges sure ones, files sure
 * non-duplicates, prints the unsure.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/judge-duplicates.ts [--max=400] [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
async function main() {
  const { judgeDuplicates } = await import("../src/lib/catalog/llm-duplicates");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 400);
  const r = await judgeDuplicates({ maxPairs: max, dryRun: !apply, log: console.log });
  console.log({ ...r, costUsd: Number(r.usage.costUsd.toFixed(3)), dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });
