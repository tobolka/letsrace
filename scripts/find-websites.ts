/**
 * Races with no website and no registration link: search for them, and keep a
 * page only if it names the race and its season.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/find-websites.ts [--max=300] [--apply]
 * Only sure finds are written (every distinctive word of the name on the page
 * and in its address, the town on it, a front page or one level in); likely
 * ones go to tmp/web-finder-review-<date>.tsv to look at. About ten seconds a
 * race — the searches are spaced out — so 200 races take half an hour. Dry
 * run by default.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { findWebsites } = await import("../src/lib/catalog/web-finder");
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 300);
  const { appendFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("tmp", { recursive: true });
  const review = `tmp/web-finder-review-${new Date().toISOString().slice(0, 10)}.tsv`;
  const result = await findWebsites({
    max,
    dryRun: !apply,
    log: console.log,
    // Likely but not sure: a person's call. One line each: id, date, race, link.
    onReview: (s) => appendFileSync(review, `${s.id}\t${s.startDate}\t${s.name}\t${s.kind}\t${s.url}\n`),
  });
  console.log({ ...result, dry: !apply, review: result.reviewed ? review : null });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
