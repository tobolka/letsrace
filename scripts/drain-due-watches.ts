import { summarizeWatches } from "../src/lib/watcher/run-summary";
import type { WatchOutcome } from "../src/lib/watcher/run";
/**
 * Poll every watched URL that is due, round after round, until none is left.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/drain-due-watches.ts [maxRounds]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}

async function main() {
  const { runDueWatches } = await import("../src/lib/watcher/run");
  const maxRounds = Number(process.argv[2] ?? 40);
  const latest = new Map<string, WatchOutcome>();
  let watched = 0;
  let upserted = 0;
  for (let round = 1; round <= maxRounds; round++) {
    const outcomes = await runDueWatches(60, { concurrency: 4, budgetMs: 170_000 });
    for (const outcome of outcomes) latest.set(outcome.watchedUrlId, outcome);
    if (!outcomes.length) break;
    const up = outcomes.reduce((s, o) => s + (o?.eventsUpserted || 0), 0);
    const failed = outcomes.filter((o) => o && o.ok === false);
    watched += outcomes.length;
    upserted += up;
    console.log({ round, watched: outcomes.length, upserted: up, failed: failed.length });
    for (const f of failed.slice(0, 5)) console.log("  pending", f.url, f.error);
    if (summarizeWatches(outcomes).deferred > 0) { console.log("AI work deferred; stopping this process instead of repeatedly rereading sources."); break; }
  }
  console.log({ total: { watched, upserted } });
  const remaining = summarizeWatches([...latest.values()]);
  console.log({ remaining });
  process.exitCode = remaining.failed ? 1 : remaining.deferred ? 2 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
