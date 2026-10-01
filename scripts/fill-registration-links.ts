/**
 * Entry links from races' own pages.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-registration-links.ts [--max=1500] [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillRegistrationLinks } = await import("../src/lib/catalog/registration-links");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 1500);
  console.log({ ...(await fillRegistrationLinks({ max, dryRun: !apply, log: console.log })), dry: !apply });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
