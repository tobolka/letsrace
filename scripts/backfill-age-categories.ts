/**
 * Fill empty event (and series) age_categories from name + series.
 * Does not overwrite non-empty age_categories.
 *
 * Usage: nvm use 22 && npx tsx scripts/backfill-age-categories.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fillEmptyAgeCategories } from "../src/lib/catalog/ages";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

fillEmptyAgeCategories({ maxEvents: 5000, upcomingOnly: true })
  .then((result) => {
    console.log(
      `Done. Events filled ${result.eventsFilled}, still unknown ${result.stillUnknown}. Series filled ${result.seriesFilled}.`,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
