/**
 * Collapse rows that share an exact fingerprint (date + geohash + normalized name).
 *
 * These are the same race by the upsert's own identity rule; they exist because
 * concurrent watcher runs can both insert before either sees the other. The
 * scoring merger never reaches them — it only scans upcoming dates.
 *
 * Usage:
 *   nvm use 22 && npx tsx scripts/merge-fingerprint-collisions.ts --dry
 *   nvm use 22 && npx tsx scripts/merge-fingerprint-collisions.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collapseFingerprintCollisions } from "../src/lib/catalog/merge-duplicates";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}
loadEnv();

collapseFingerprintCollisions({ dry: process.argv.includes("--dry") })
  .then((r) => {
    r.preview.slice(0, 60).forEach((p) => console.log("  ", p));
    console.log({ collisions: r.collisions, merged: r.merged, dry: r.dry });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
