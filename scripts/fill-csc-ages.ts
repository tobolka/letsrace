/**
 * Read categories from Czech federation race pages (needs local Chrome).
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-csc-ages.ts          # dry run
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-csc-ages.ts --apply  # write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillCscAgeCategories } = await import("../src/lib/catalog/csc-ages");
  const apply = process.argv.includes("--apply");
  const result = await fillCscAgeCategories({ max: 400, budgetMs: 30 * 60_000, dryRun: !apply, log: console.log });
  console.log({ ...result, dry: !apply });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
