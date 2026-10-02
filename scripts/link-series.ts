/**
 * Races whose names carry a series, linked to it: grouped by code, the series
 * name confirmed by a model, linked by code.
 *   LLM_BUDGET_USD=0.3 node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/link-series.ts [--countries=DE,CZ,PL,SK] [--apply]
 */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }
async function main() {
  const apply = process.argv.includes("--apply");
  const countries = process.argv.find((a) => a.startsWith("--countries="))?.slice(12).split(",");
  const { proposeSeriesLinks, confirmSeriesProposals, applySeriesLinks } = await import("../src/lib/catalog/series-linker");
  const proposals = await proposeSeriesLinks({ countries });
  console.log(`${proposals.length} proposals, ${proposals.reduce((n, g) => n + g.races.length, 0)} races`);
  const { confirmed, usage } = await confirmSeriesProposals(proposals);
  for (const g of confirmed) console.log(`${apply ? "OK " : "DRY"} ${g.name}${g.existing ? "" : " (new)"} [${g.country}] ← ${g.races.map((r) => r.name).slice(0, 5).join(" | ")}${g.races.length > 5 ? ` … +${g.races.length - 5}` : ""}`);
  const rejected = proposals.filter((p) => !confirmed.some((c) => c.key === p.key));
  for (const g of rejected) console.log(`NO  ${g.name} ← ${g.races.map((r) => r.name).slice(0, 3).join(" | ")}`);
  if (apply) console.log(await applySeriesLinks(confirmed));
  console.log({ confirmed: confirmed.length, races: confirmed.reduce((n, g) => n + g.races.length, 0), costUsd: Number(usage.costUsd.toFixed(3)), dry: !apply });
}
main().catch((e) => { console.error(e); process.exit(1); });
