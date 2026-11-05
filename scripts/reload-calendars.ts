import { summarizeWatches, reportWatchBatch } from "../src/lib/watcher/run-summary";
import type { WatchOutcome } from "../src/lib/watcher/run";
/**
 * Force-poll official calendars and print watch outcomes.
 * Usage: node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/reload-calendars.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { runDueWatches } from "../src/lib/watcher/run";

try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const val = m[2]!.replace(/^["']|["']$/g, "");
    // An intentionally blank key belongs to the isolated Mac reader; never
    // reload production credentials or paid-provider keys into that process.
    process.env[m[1]!] ??= val;
  }
} catch {
  /* ignore */
}

async function main() {
  const arg = (key: string, fallback: number) => Number(process.argv.find(value => value.startsWith(`--${key}=`))?.split("=")[1] ?? fallback);
  const rounds = arg("rounds", 5), limit = arg("limit", 60), seconds = arg("seconds", 170);
  if (![rounds, limit, seconds].every(Number.isInteger) || rounds < 1 || rounds > 40 || limit < 1 || limit > 120 || seconds < 15 || seconds > 260) throw Error("Invalid source batch limits");
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  // Force is an explicit maintenance action; normal cycles preserve retry schedules.
  if (process.argv.includes("--force")) {
  const { error: dueErr } = await supabase
    .from("watched_urls")
    .update({ next_poll_at: now, updated_at: now })
    .eq("status", "active")
    .in("kind", ["series", "federation", "aggregator", "calendar"])
    .not("url", "ilike", "%federciclismo.it%")
    .not("url", "ilike", "%eventivsport.com%")
    .not("url", "ilike", "%ffc.fr%")
    .not("url", "ilike", "%ffvelo.fr%");
  if (dueErr) throw new Error(dueErr.message);
  }

  const latest = new Map<string, WatchOutcome>();
  let watched = 0;
  let upserted = 0;
  let failed = 0;
  const fails: { url: string; error?: string }[] = [];

  for (let round = 1; round <= rounds; round++) {
    const outcomes = await runDueWatches(limit, { concurrency: Number(process.env.LOCAL_WORKER_CONCURRENCY ?? 4), budgetMs: seconds * 1000 });
    reportWatchBatch(outcomes);
    for (const outcome of outcomes) latest.set(outcome.watchedUrlId, outcome);
    if (!outcomes.length) {
      console.log({ round, stopped: "nothing due" });
      break;
    }
    const okUpsert = outcomes.reduce((s, o) => s + (o?.eventsUpserted || 0), 0);
    const roundFail = outcomes.filter((o) => o && o.ok === false);
    watched += outcomes.length;
    upserted += okUpsert;
    failed += roundFail.length;
    for (const o of roundFail) {
      if (o.error !== "time budget exceeded") fails.push({ url: o.url, error: o.error });
    }
    console.log({
      round,
      watched: outcomes.length,
      upserted: okUpsert,
      failed: roundFail.length,
      ok: outcomes.filter((o) => o?.ok).length,
      deferred: summarizeWatches(outcomes).deferred,
    });
    if (summarizeWatches(outcomes).deferred > 0) { console.log("AI work deferred; stopping this process instead of repeatedly rereading sources."); break; }
  }

  console.log(JSON.stringify({ summary: { watched, upserted, failed, failSamples: fails.slice(0, 12) } },null,2));
  const remaining = summarizeWatches([...latest.values()]);
  console.log({ remaining });
  process.exitCode = remaining.failed ? 1 : remaining.deferred ? 2 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
