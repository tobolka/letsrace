/**
 * Entry form and regulations PDF from each race's page on kalendar.sportsoft.cz.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-sportsoft-links.ts [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

async function main() {
  const { fillSportsoftLinks } = await import("../src/lib/catalog/sportsoft-links");
  const dryRun = !process.argv.includes("--apply");
  console.log({ ...(await fillSportsoftLinks({ dryRun, log: console.log })), dry: dryRun });
}
main().catch((e) => { console.error(e); process.exit(1); });
