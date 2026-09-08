/**
 * Collapse spelling variants of one place, and take the pin off venues that
 * are nothing but a country's name.
 *
 * Usage: nvm use 22 && npx tsx scripts/merge-locations.ts --dry
 *        nvm use 22 && npx tsx scripts/merge-locations.ts --max=1000
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeDuplicateLocations } from "../src/lib/catalog/merge-locations";

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

const dryRun = process.argv.includes("--dry");
const maxArg = process.argv.find((a) => a.startsWith("--max="));
const max = maxArg ? Number(maxArg.slice("--max=".length)) : 2000;

mergeDuplicateLocations({ dryRun, max })
  .then((result) => {
    console.log({ dryRun, ...result, failed: result.failed.length });
    for (const f of result.failed.slice(0, 10)) console.error(f);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
