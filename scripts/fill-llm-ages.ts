/**
 * Categories a race states, read by a language model with a verbatim quote.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-llm-ages.ts [--max=40] [--ids=a,b] [--apply]
 * Needs ANTHROPIC_API_KEY in .env.local. Prints the token count and cost.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillAgesWithModel } = await import("../src/lib/catalog/llm-ages");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 40);
  const ids = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",");
  const r = await fillAgesWithModel({ max, ids, dryRun: !apply, log: console.log });
  console.log({ ...r, costUsd: Number(r.costUsd.toFixed(3)), dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });
