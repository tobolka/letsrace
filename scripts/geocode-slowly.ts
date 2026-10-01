/**
 * Geocode every pending place, slowly: Nominatim allows one request a second
 * and answers 429 when pushed. On a 429 this waits and goes on, instead of
 * leaving hundreds of places without a pin until the next run.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/geocode-slowly.ts [minutes]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { geocodePendingLocations } = await import("../src/lib/geocode");
  const until = Date.now() + Number(process.argv[2] ?? 45) * 60_000;
  let updated = 0;
  let idle = 0;
  while (Date.now() < until) {
    const r = await geocodePendingLocations(40);
    updated += r.updated;
    console.log(new Date().toISOString().slice(11, 19), r);
    if (r.unavailable) {
      await new Promise((res) => setTimeout(res, 120_000));
      continue;
    }
    // What is left can be places no one can find ("United Kingdom", a
    // country alone): stop once three batches in a row found nothing.
    idle = r.updated ? 0 : idle + 1;
    if (!r.attempted || idle >= 3) break;
    await new Promise((res) => setTimeout(res, 5_000));
  }
  console.log({ updated });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
