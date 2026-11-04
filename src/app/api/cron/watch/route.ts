import { pipelineJob } from "@/lib/pipeline/operations";
import { NextResponse } from "next/server";
import { withCron } from "@/lib/api/guards";
import { runDueWatches } from "@/lib/watcher/run";
import { watchBatchResult } from "@/lib/watcher/run-summary";
import { sendOpsAlert } from "@/lib/ops/alerts";

export const maxDuration = 300;

export const GET = withCron(async (req) => NextResponse.json(await pipelineJob("server-free", async () => {
  /*
   * A run gets through what it gets through, and it was not much.
   *
   * Measured over three days: 27 to 50 sources per run, at 22 to 42 seconds
   * each. Five at a time inside a 200-second budget works out to about
   * thirty-five — so three runs a day covered a hundred of the four hundred
   * active sources, and a full cycle took the better part of four days. The
   * tail of that is a race whose listing was last read four weeks ago.
   *
   * The time is nearly all network wait, so widening the pool costs little and
   * the busiest hosts are already held to two sources a run. `maxDuration` is
   * 300s, which is what the budget leaves room under.
   */
  // Cap below the old 120/80: each watch is many PostgREST round-trips, and
  // Free-tier Supabase egress + log ingestion were already over quota from
  // catalogue traffic alone. Prefer a slower poll cycle over blowing the plan.
  const outcomes = await runDueWatches(60, { concurrency: 6, budgetMs: 200_000 });
  // Rows land in the DB; public pages pick them up on their weekly ISR window.
  // A full-tag revalidate here rewrote every race/hub cache entry and blew the
  // Hobby ISR write + Origin Transfer budgets when crawlers rewarmed.

  const result = watchBatchResult(outcomes);
  const failRate = result.count ? result.failed / result.count : 0;
  if (req.headers.get("x-letsrace-monitor") !== "1" && (result.failed >= 3 || failRate >= 0.35)) {
    await sendOpsAlert({
      title: "Let's Race ingest: elevated failures",
      body: `${result.failed}/${result.count} watches failed in this cron run.`,
      meta: {
        failRate: Number(failRate.toFixed(2)),
      },
    });
  }

  return result;
})));

export const POST = GET;
