/**
 * Organisers' websites for Italian federation races.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-fci-websites.ts [--max=300] [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillFciWebsites } = await import("../src/lib/catalog/fci-website");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 300);
  console.log({ ...(await fillFciWebsites({ max, dryRun: !apply, log: console.log })), dry: !apply });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
