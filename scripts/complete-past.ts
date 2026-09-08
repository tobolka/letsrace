/**
 * Mark races whose day has passed as `completed`.
 * Usage: nvm use 22 && npx tsx scripts/complete-past.ts --dry
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { completePastEvents } from "../src/lib/catalog/complete-past";

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

completePastEvents({ dryRun, max: maxArg ? Number(maxArg.slice(6)) : 20_000 })
  .then((r) => console.log({ dryRun, ...r }))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
