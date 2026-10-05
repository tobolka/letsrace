/**
 * The per-race readers that work without Chrome, run wide: RaceResult contest
 * names, Italian federation pages, then geocoding, then the discipline default
 * for whatever is still empty (stored as a guess).
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/fill-source-ages.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { fillRaceResultAgeCategories } = await import("../src/lib/catalog/raceresult-ages");
  const { fillRegistrationAgeEvidence } = await import("../src/lib/catalog/registration-ages");
  const { fillFciAgeCategories } = await import("../src/lib/catalog/fci-ages");
  const { geocodePendingLocations } = await import("../src/lib/geocode");
  const { fillEmptyAgeCategories } = await import("../src/lib/catalog/ages");
  console.log("raceresult", await fillRaceResultAgeCategories({ max: 400 }));
  console.log("registration evidence", await fillRegistrationAgeEvidence({ max: 400 }));
  console.log("fci", await fillFciAgeCategories({ max: 600 }));
  console.log("geocode", await geocodePendingLocations(600));
  console.log("defaults", await fillEmptyAgeCategories({ maxEvents: 3000 }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
