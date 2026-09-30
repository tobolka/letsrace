/**
 * Read categories from races' own regulations (propozice), PDF or HTML.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-regulation-ages.ts [CZ,SK] [--max=200]          # dry run
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-regulation-ages.ts [CZ,SK] [--max=200] --apply  # write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillRegulationAgeCategories } = await import("../src/lib/catalog/regulation-ages");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 200);
  const countries = process.argv.slice(2).find((a) => /^[A-Z]{2}(,[A-Z]{2})*$/.test(a))?.split(",");
  const result = await fillRegulationAgeCategories({ max, countries, dryRun: !apply, log: console.log });
  console.log({ ...result, dry: !apply });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
