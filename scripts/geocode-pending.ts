/**
 * Fill pending map pins (gazetteer, then Nominatim).
 * Usage: nvm use 22 && npx tsx scripts/geocode-pending.ts [limit]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { geocodePendingLocations } from "../src/lib/geocode";

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

const limit = Number(process.argv[2] || 40);
geocodePendingLocations(limit).then((r) => {
  console.log(r);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
