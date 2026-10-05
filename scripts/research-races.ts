/**
 * Search the web for each race's own site, entry page and regulations; keep
 * only what opens and names the race and its date.
 *   LLM_BUDGET_USD=0.5 node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/research-races.ts [--countries=CZ,DE] [--ids=a,b] [--max=50] [--without-site] [--ignore-known (test, dry)] [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);

async function main() {
  const { researchRaces } = await import("../src/lib/catalog/web-research");
  const dryRun = !process.argv.includes("--apply");
  const result = await researchRaces({
    dryRun,
    max: Number(arg("max") ?? 50),
    countries: (arg("countries") ?? process.env.CATALOG_COUNTRIES)?.split(","),
    ids: arg("ids")?.split(","),
    withoutSite: process.argv.includes("--without-site"),
    ignoreKnown: process.argv.includes("--ignore-known"),
    log: console.log,
  });
  console.log({ ...result, dry: dryRun });
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
