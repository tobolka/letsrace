/** Age classes from the regulations already read into a race's practical details (fees, timetable, categories).
 *  node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-practical-ages.ts [--dry] */
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }
async function main() {
  const { fillAgesFromRegulations } = await import("../src/lib/catalog/practical-ages");
  console.log(await fillAgesFromRegulations({ dryRun: process.argv.includes("--dry"), log: console.log }));
}
main().catch((e) => { console.error(e); process.exit(1); });
