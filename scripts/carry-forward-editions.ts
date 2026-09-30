/**
 * Give this year's races what last year's edition knew: stated categories
 * (as "last year"), discipline, class, website.
 *
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/carry-forward-editions.ts          # dry run
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/carry-forward-editions.ts --apply  # write
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { carryForwardFromPreviousEditions } = await import("../src/lib/catalog/previous-edition");
  const apply = process.argv.includes("--apply");
  const result = await carryForwardFromPreviousEditions({ dryRun: !apply, log: console.log });
  console.log({ ...result, dry: !apply });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
