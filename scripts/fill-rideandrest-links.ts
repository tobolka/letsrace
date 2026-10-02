/**
 * A rideandrest.net page as the website of an Italian race that has none.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-rideandrest-links.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillRideAndRestLinks } = await import("../src/lib/catalog/rideandrest-links");
  const apply = process.argv.includes("--apply");
  console.log({ ...(await fillRideAndRestLinks({ dryRun: !apply, log: console.log })), dry: !apply });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
