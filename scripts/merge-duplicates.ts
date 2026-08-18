/**
 * Merge public events that the soft-dedup scorer considers the same race.
 * Usage: nvm use 22 && npx tsx scripts/merge-duplicates.ts
 *        nvm use 22 && npx tsx scripts/merge-duplicates.ts --dry
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergePublicDuplicates } from "../src/lib/catalog/merge-duplicates";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2]!.replace(/^["']|["']$/g, "");
      if (!process.env[m[1]!]) process.env[m[1]!] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const DRY = process.argv.includes("--dry");

mergePublicDuplicates({
  dry: DRY,
  fromDate: `${new Date().getUTCFullYear()}-01-01`,
})
  .then((result) => {
    console.log({
      events: result.events,
      pairs: result.pairs,
      merged: result.merged,
      dry: result.dry,
    });
    for (const m of result.preview) {
      console.log(
        `${DRY ? "DRY" : "MERGE"} ${m.date}  ${m.keep}  ←  ${m.drop}  [${m.reasons.join(",")}]`,
      );
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
