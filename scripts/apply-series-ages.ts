/** Confirmed series categories onto every upcoming round. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
import("../src/lib/catalog/series-ages").then(async (m) => console.log(await m.applySeriesAgesToRounds(undefined, { dryRun: process.argv.includes("--dry"), log: console.log })));
